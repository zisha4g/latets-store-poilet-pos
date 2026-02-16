import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart3, DollarSign, TrendingUp, Package, AlertCircle, Download, Printer, XCircle, RotateCcw } from 'lucide-react';
import SaleDetailModal from './SaleDetailModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from '@/components/ui/use-toast';
import { useReactToPrint } from 'react-to-print';
import Receipt from './Receipt';

const MetricCard = ({ title, value, icon: Icon }) => (
  <div className="bg-card rounded-xl p-6 shadow-md">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-primary">{value}</p>
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" />
      </div>
    </div>
  </div>
);


const ReportsView = ({ sales, products, customers, categories = [], settings, handlers }) => {
  const [filter, setFilter] = useState('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [reportTab, setReportTab] = useState('summary'); // summary | byProduct | byCategory | byPayment
  const [compare, setCompare] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // for table searches
  const [selectedSale, setSelectedSale] = useState(null);
  const [isProcessingVoid, setIsProcessingVoid] = useState(false);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const receiptRef = useRef();

  // Debug: Check if handlers are available
  console.log('🔍 ReportsView - handlers available:', !!handlers);
  console.log('🔍 ReportsView - handlers.sales available:', !!handlers?.sales);

  const handlePrintReceipt = useReactToPrint({
    content: () => receiptRef.current,
  });

  // Void sale handler
  const handleVoidSale = async () => {
    if (!selectedSale || !handlers) {
      toast({ title: "Error", description: "Cannot void sale - missing data", variant: "destructive" });
      return;
    }

    // Confirm void action
    const confirmVoid = window.confirm(
      `Are you sure you want to VOID sale #${selectedSale.id.slice(0, 8)}?\n\n` +
      `This will remove $${selectedSale.total.toFixed(2)} from your reports.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmVoid) return;

    setIsProcessingVoid(true);
    try {
      // Update sale status to voided
      await handlers.sales.update({
        ...selectedSale,
        status: 'voided',
        voided_at: new Date().toISOString(),
      });

      toast({ 
        title: "Sale Voided", 
        description: `Sale #${selectedSale.id.slice(0, 8)} has been voided and removed from reports.`,
      });
      
      setSelectedSale(null);
    } catch (error) {
      console.error('Error voiding sale:', error);
      toast({ 
        title: "Error", 
        description: `Failed to void sale: ${error.message}`,
        variant: "destructive" 
      });
    } finally {
      setIsProcessingVoid(false);
    }
  };

  // Process return handler
  const handleProcessReturn = async () => {
    if (!selectedSale || !handlers) {
      toast({ title: "Error", description: "Cannot process return - missing data", variant: "destructive" });
      return;
    }

    // Confirm return action
    const confirmReturn = window.confirm(
      `Process RETURN for sale #${selectedSale.id.slice(0, 8)}?\n\n` +
      `This will:\n` +
      `- Create a negative sale entry for $${selectedSale.total.toFixed(2)}\n` +
      `- Restore inventory quantities\n` +
      `- Update your reports\n\n` +
      `Continue?`
    );

    if (!confirmReturn) return;

    setIsProcessingReturn(true);
    try {
      // Create return transaction (negative sale)
      const returnSale = {
        customer_id: selectedSale.customer_id,
        items: selectedSale.items.map(item => ({
          ...item,
          quantity: -item.quantity // Negative quantities for return
        })),
        subtotal: -selectedSale.subtotal,
        total: -selectedSale.total,
        tax_amount: -getTaxesSum(selectedSale),
        tax_rate: selectedSale.tax_rate || 0,
        taxes: Array.isArray(selectedSale.taxes) 
          ? selectedSale.taxes.map(t => ({ ...t, amount: -t.amount }))
          : [],
        service_charge: -(getServiceChargesSum(selectedSale)),
        service_charges_applied: Array.isArray(selectedSale.service_charges_applied)
          ? selectedSale.service_charges_applied.map(sc => ({ ...sc, amount: -sc.amount }))
          : [],
        discount_amount: -selectedSale.discount_amount || 0,
        payment_method: 'return',
        status: 'completed',
        return_of_sale_id: selectedSale.id,
        created_at: new Date().toISOString(),
        date: new Date().toISOString(),
      };

      await handlers.sales.add(returnSale);

      // Update inventory for returned items
      if (handlers.products && Array.isArray(selectedSale.items)) {
        for (const item of selectedSale.items) {
          const product = products.find(p => p.id === item.product_id || p.name === item.name);
          if (product && typeof product.stock === 'number') {
            await handlers.products.update({
              ...product,
              stock: product.stock + item.quantity // Add back returned quantity
            });
          }
        }
      }

      // Mark original sale as returned
      await handlers.sales.update({
        ...selectedSale,
        status: 'returned',
        returned_at: new Date().toISOString(),
      });

      toast({ 
        title: "Return Processed", 
        description: `Return for sale #${selectedSale.id.slice(0, 8)} completed. Inventory updated.`,
      });
      
      setSelectedSale(null);
    } catch (error) {
      console.error('Error processing return:', error);
      toast({ 
        title: "Error", 
        description: `Failed to process return: ${error.message}`,
        variant: "destructive" 
      });
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const computeRange = () => {
    const now = new Date();
    let startDate, endDate = new Date();
    switch (filter) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last7':
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last30':
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        startDate = customRange.start ? new Date(customRange.start) : null;
        endDate = customRange.end ? new Date(customRange.end) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(0);
    }
    if (!endDate) endDate = new Date();
    return { startDate, endDate };
  };

  const { startDate, endDate } = computeRange();
  const getSaleDate = (sale) => new Date(sale.date || sale.created_at || sale.timestamp);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Exclude voided sales from reports
      if (sale.status === 'voided') return false;
      
      const saleDate = getSaleDate(sale);
      if (filter === 'custom') {
        const startMatch = startDate ? saleDate >= startDate : true;
        const endMatch = endDate ? saleDate <= endDate : true;
        return startMatch && endMatch;
      }
      return saleDate >= startDate && saleDate <= endDate;
    });
  }, [sales, filter, customRange, startDate, endDate]);

  const previousRangeSales = useMemo(() => {
    if (!compare || !startDate || !endDate) return [];
    const ms = endDate - startDate;
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - ms);
    return sales.filter(sale => {
      const d = getSaleDate(sale);
      return d >= prevStart && d <= prevEnd;
    });
  }, [compare, sales, startDate, endDate]);

  // Normalizers for sale shapes and summary metrics
  const getTaxesSum = (sale) => {
    // Check for tax_amount field first
    if (typeof sale.tax_amount === 'number') return sale.tax_amount;
    
    // Check for taxes array
    if (Array.isArray(sale.taxes) && sale.taxes.length > 0) {
      return sale.taxes.reduce((s, t) => s + (t.amount || 0), 0);
    }
    
    // No taxes found
    return 0;
  };
  const getServiceSum = (sale) => {
    if (typeof sale.service_charge === 'number') return sale.service_charge;
    if (Array.isArray(sale.service_charges_applied)) return sale.service_charges_applied.reduce((s, sc) => s + (sc.amount || 0), 0);
    return 0;
  };
  const getItemsSubtotal = (sale) => {
    if (typeof sale.subtotal === 'number') return sale.subtotal;
    if (Array.isArray(sale.items)) return sale.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0);
    return sale.total || 0;
  };
  
  // Calculate COGS (Cost of Goods Sold) from sale items
  const getCOGS = (sale) => {
    if (!Array.isArray(sale.items)) return 0;
    return sale.items.reduce((sum, item) => {
      const cost = item.cost_price || 0;
      const quantity = item.quantity || 0;
      return sum + (cost * quantity);
    }, 0);
  };

  const totalRevenue = filteredSales.reduce((total, sale) => total + (sale.total || 0), 0);
  const totalSales = filteredSales.length;
  const totalProducts = products.length;
  const totalSubtotal = filteredSales.reduce((s, sale) => s + getItemsSubtotal(sale), 0);
  const totalTaxes = filteredSales.reduce((s, sale) => s + getTaxesSum(sale), 0);
  const totalService = filteredSales.reduce((s, sale) => s + getServiceSum(sale), 0);
  const totalDiscounts = Math.max(0, (totalSubtotal - (totalRevenue - totalTaxes - totalService)));
  const totalCOGS = filteredSales.reduce((s, sale) => s + getCOGS(sale), 0);
  const netProfit = (totalRevenue - totalTaxes - totalService) - totalCOGS; // Net Sales - COGS
  const aov = totalSales > 0 ? totalRevenue / totalSales : 0;

  const handleDownloadExcel = () => {
    let dataset = [];
    if (reportTab === 'summary') {
      // Add a Summary sheet and a Sales sheet
      const summaryRows = [
        { Metric: 'Item Sales (Net)', Amount: (totalSubtotal - totalDiscounts).toFixed(2) },
        { Metric: 'Service Charges', Amount: totalService.toFixed(2) },
        { Metric: 'Other Income', Amount: (0).toFixed(2) },
        { Metric: 'Sales Tax', Amount: totalTaxes.toFixed(2) },
        { Metric: 'Total Collected', Amount: totalRevenue.toFixed(2) },
        { Metric: '', Amount: '' }, // Blank row
        { Metric: 'Cost of Goods Sold', Amount: `-${totalCOGS.toFixed(2)}` },
        { Metric: 'Net Profit', Amount: netProfit.toFixed(2) },
      ];
      const paymentsRows = byPayment.map(p => ({ Method: p.method, Orders: p.count, Amount: p.revenue.toFixed(2) }));
      const salesRows = filteredSales.map(sale => ({
        'Sale ID': sale.id,
        'Date': getSaleDate(sale).toLocaleString(),
        'Customer': customers.find(c => c.id === sale.customer_id)?.name || 'Guest',
        'Items': (sale.items || []).length,
        'Subtotal': getItemsSubtotal(sale),
        'Tax': getTaxesSum(sale),
        'Service Charge': getServiceSum(sale),
        'Total': sale.total,
        'Payment Method': sale.payment_method,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentsRows), 'Payments');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'Sales');
      XLSX.writeFile(wb, `Report_${reportTab}.xlsx`);
      toast({ title: 'Excel Report Downloaded' });
      return;
    } else if (reportTab === 'byProduct') {
      dataset = byProduct.map(r => ({ Product: r.name, Quantity: r.quantity, Revenue: r.revenue }));
    } else if (reportTab === 'byCategory') {
      dataset = byCategory.map(r => ({ Category: r.name, Quantity: r.quantity, Revenue: r.revenue }));
    } else if (reportTab === 'byPayment') {
      dataset = byPayment.map(r => ({ Method: r.method, Count: r.count, Revenue: r.revenue }));
    } else if (reportTab === 'byTax') {
      dataset = byTax.map(r => ({ Tax: r.name, Rate: r.rate ?? '', Taxable: r.taxable, Collected: r.amount }));
    }
    const worksheet = XLSX.utils.json_to_sheet(dataset);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `Report_${reportTab}.xlsx`);
    toast({ title: "Excel Report Downloaded" });
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const title = 'Sales Summary Report';
    const dateLine = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    doc.setFontSize(16); doc.text(title, 14, 16);
    doc.setFontSize(11); doc.text(dateLine, 14, 23);

    // Summary table similar to QuickBooks style
    const summaryBody = [
      ['Item Sales (Net)', `$${(totalSubtotal - totalDiscounts).toFixed(2)}`],
      ['Service Charges', `$${totalService.toFixed(2)}`],
      ['Other Income', `$${(0).toFixed(2)}`],
      ['Sales Tax', `$${totalTaxes.toFixed(2)}`],
      ['Total Collected', `$${totalRevenue.toFixed(2)}`],
      ['', ''], // Blank row
      ['Cost of Goods Sold', `-$${totalCOGS.toFixed(2)}`],
      ['Net Profit', `$${netProfit.toFixed(2)}`],
    ];
    doc.autoTable({
      startY: 30,
      head: [['Metric', 'Amount']],
      body: summaryBody,
      styles: { cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240] },
    });

    // Payment breakdown
    const afterSummaryY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 6 : 30;
    doc.autoTable({
      startY: afterSummaryY,
      head: [['Payment Method', 'Orders', 'Amount']],
      body: byPayment.map(p => [p.method, p.count, `$${p.revenue.toFixed(2)}`]),
      styles: { cellPadding: 2 },
      headStyles: { fillColor: [240, 240, 240] },
    });

    // Optional: compact list of recent sales
    const afterPaymentsY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 6 : afterSummaryY + 40;
    doc.autoTable({
      startY: afterPaymentsY,
      head: [['Date', 'Customer', 'Items', 'Total', 'Payment']],
      body: filteredSales.slice(0, 20).map(sale => [
        getSaleDate(sale).toLocaleDateString(),
        customers.find(c => c.id === sale.customer_id)?.name || 'Guest',
        (sale.items || []).length,
        `$${(sale.total || 0).toFixed(2)}`,
        sale.payment_method
      ]),
      styles: { fontSize: 9 },
    });
    doc.save('SalesSummary.pdf');
    toast({ title: 'PDF Report Downloaded' });
  };

  // Aggregations for additional report tabs
  const byProduct = useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      for (const item of (sale.items || [])) {
        const key = item.product_id || item.id;
        const entry = map.get(key) || { quantity: 0, revenue: 0, product_id: key };
        entry.quantity += item.quantity || 0;
        entry.revenue += (item.price || 0) * (item.quantity || 0);
        map.set(key, entry);
      }
    }
    const list = Array.from(map.values()).map(e => ({
      ...e,
      name: products.find(p => p.id === e.product_id)?.name || 'Unknown'
    }));
    const term = searchTerm.toLowerCase();
    return list
      .filter(r => r.name.toLowerCase().includes(term))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products, searchTerm]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      for (const item of (sale.items || [])) {
        const product = products.find(p => p.id === (item.product_id || item.id));
        const catId = product?.category_id || 'uncategorized';
        const entry = map.get(catId) || { quantity: 0, revenue: 0, category_id: catId };
        entry.quantity += item.quantity || 0;
        entry.revenue += (item.price || 0) * (item.quantity || 0);
        map.set(catId, entry);
      }
    }
    const list = Array.from(map.values()).map(e => ({
      ...e,
      name: categories.find(c => c.id === e.category_id)?.name
        || products.find(p => p.category_id === e.category_id)?.category_name
        || (e.category_id === 'uncategorized' ? 'Uncategorized' : 'Category')
    }));
    const term = searchTerm.toLowerCase();
    return list
      .filter(r => (r.name || '').toLowerCase().includes(term))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, products, categories, searchTerm]);

  const byPayment = useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      const method = sale.payment_method || 'Unknown';
      const entry = map.get(method) || { method, count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += sale.total || 0;
      map.set(method, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Sales Tax breakdown
  const byTax = useMemo(() => {
    const map = new Map();
    for (const sale of filteredSales) {
      const taxes = Array.isArray(sale.taxes)
        ? sale.taxes
        : (typeof sale.tax_amount === 'number' ? [{ name: 'Tax', rate: null, amount: sale.tax_amount }] : []);
      for (const t of taxes) {
        const rate = (typeof t.rate === 'number' ? t.rate : null);
        const key = `${t.name || 'Tax'}|${rate ?? 'n/a'}`;
        const entry = map.get(key) || { name: t.name || 'Tax', rate, amount: 0, taxable: 0 };
        entry.amount += (t.amount || 0);
        if (rate && rate > 0) entry.taxable += (t.amount || 0) / (rate / 100);
        map.set(key, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredSales]);

  return (
    <>
      <motion.div
        key="reports"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-6 overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-primary">Sales Reports & Analytics</h2>
          <div className="flex space-x-2">
            <Button onClick={handleDownloadExcel} variant="outline"><Download className="w-4 h-4 mr-2" /> Excel</Button>
            <Button onClick={handleDownloadPdf} variant="outline"><Download className="w-4 h-4 mr-2" /> PDF</Button>
          </div>
        </div>
        {/* Date range and report tabs */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center flex-wrap gap-2 bg-secondary p-2 rounded-lg">
            <Button onClick={() => setFilter('today')} variant={filter === 'today' ? 'default' : 'ghost'}>Today</Button>
            <Button onClick={() => setFilter('last7')} variant={filter === 'last7' ? 'default' : 'ghost'}>Last 7 days</Button>
            <Button onClick={() => setFilter('last30')} variant={filter === 'last30' ? 'default' : 'ghost'}>Last 30 days</Button>
            <Button onClick={() => setFilter('month')} variant={filter === 'month' ? 'default' : 'ghost'}>This Month</Button>
            <Button onClick={() => setFilter('lastMonth')} variant={filter === 'lastMonth' ? 'default' : 'ghost'}>Last Month</Button>
            <Button onClick={() => setFilter('ytd')} variant={filter === 'ytd' ? 'default' : 'ghost'}>YTD</Button>
            <Button onClick={() => setFilter('custom')} variant={filter === 'custom' ? 'default' : 'ghost'}>Custom</Button>
            {filter === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" value={customRange.start} onChange={e => setCustomRange(prev => ({...prev, start: e.target.value}))} />
                <span>to</span>
                <Input type="date" value={customRange.end} onChange={e => setCustomRange(prev => ({...prev, end: e.target.value}))} />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Compare prev. period</label>
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            <Button onClick={() => setReportTab('summary')} variant={reportTab === 'summary' ? 'default' : 'outline'}>Summary</Button>
            <Button onClick={() => setReportTab('byProduct')} variant={reportTab === 'byProduct' ? 'default' : 'outline'}>By Product</Button>
            <Button onClick={() => setReportTab('byCategory')} variant={reportTab === 'byCategory' ? 'default' : 'outline'}>By Category</Button>
            <Button onClick={() => setReportTab('byPayment')} variant={reportTab === 'byPayment' ? 'default' : 'outline'}>By Payment</Button>
            <Button onClick={() => setReportTab('byTax')} variant={reportTab === 'byTax' ? 'default' : 'outline'}>Sales Tax</Button>
            {(reportTab === 'byProduct' || reportTab === 'byCategory') && (
              <div className="ml-auto">
                <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {reportTab === 'summary' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard title="Gross Sales" value={`$${totalSubtotal.toFixed(2)}`} icon={DollarSign} />
              <MetricCard title="Discounts" value={`$${totalDiscounts.toFixed(2)}`} icon={DollarSign} />
              <MetricCard title="Net Sales" value={`$${(totalSubtotal - totalDiscounts).toFixed(2)}`} icon={DollarSign} />
              <MetricCard title="Tax Collected" value={`$${totalTaxes.toFixed(2)}`} icon={DollarSign} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard title="Service Charges" value={`$${totalService.toFixed(2)}`} icon={DollarSign} />
              <MetricCard title="Orders" value={totalSales} icon={TrendingUp} />
              <MetricCard title="COGS" value={`$${totalCOGS.toFixed(2)}`} icon={Package} />
              <MetricCard title="Net Profit" value={`$${netProfit.toFixed(2)}`} icon={TrendingUp} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-card rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Summary Breakdown</h3>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-t"><td className="py-2 pr-2">Item Sales (Net)</td><td className="py-2 pr-2 text-right">${(totalSubtotal - totalDiscounts).toFixed(2)}</td></tr>
                      <tr className="border-t"><td className="py-2 pr-2">Service Charges</td><td className="py-2 pr-2 text-right">${totalService.toFixed(2)}</td></tr>
                      <tr className="border-t"><td className="py-2 pr-2">Other Income</td><td className="py-2 pr-2 text-right">${(0).toFixed(2)}</td></tr>
                      <tr className="border-t"><td className="py-2 pr-2">Sales Tax</td><td className="py-2 pr-2 text-right">${totalTaxes.toFixed(2)}</td></tr>
                      <tr className="border-t font-semibold"><td className="py-2 pr-2">Total Collected</td><td className="py-2 pr-2 text-right">${totalRevenue.toFixed(2)}</td></tr>
                      <tr className="border-t border-t-2 mt-2"><td className="py-2 pr-2 text-destructive">Cost of Goods Sold</td><td className="py-2 pr-2 text-right text-destructive">-${totalCOGS.toFixed(2)}</td></tr>
                      <tr className="border-t font-bold text-lg"><td className="py-2 pr-2 text-primary">Net Profit</td><td className="py-2 pr-2 text-right text-primary">${netProfit.toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-card rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Payment Breakdown</h3>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground"><th className="py-2 pr-2">Method</th><th className="py-2 pr-2">Orders</th><th className="py-2 pr-2">Amount</th></tr>
                    </thead>
                    <tbody>
                      {byPayment.map((p) => (
                        <tr key={p.method} className="border-t"><td className="py-2 pr-2">{p.method}</td><td className="py-2 pr-2">{p.count}</td><td className="py-2 pr-2">${p.revenue.toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {compare && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard title="Prev Revenue" value={`$${previousRangeSales.reduce((t,s)=>t+(s.total||0),0).toFixed(2)}`} icon={DollarSign} />
                <MetricCard title="Prev Sales" value={previousRangeSales.length} icon={TrendingUp} />
              </div>
            )}
          </>
        )}

        {reportTab === 'summary' && (
          <div className="bg-card rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Sales</h3>
            {filteredSales.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">No sales data for this period</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSales.slice(0, 10).map((sale) => (
                  <div key={sale.id} className="flex justify-between items-center p-3 bg-secondary rounded-lg hover:bg-primary/10 cursor-pointer" onClick={() => setSelectedSale(sale)}>
                    <div>
                      <p className="font-medium">Sale #{(sale.id || '').toString().slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        {getSaleDate(sale).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${(sale.total || 0).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{(sale.items || []).length} items</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {reportTab === 'byProduct' && (
          <div className="bg-card rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Sales by Product</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-2">Product</th>
                    <th className="py-2 pr-2">Quantity</th>
                    <th className="py-2 pr-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map((r) => (
                    <tr key={`${r.product_id}`} className="border-t">
                      <td className="py-2 pr-2">{r.name}</td>
                      <td className="py-2 pr-2">{r.quantity}</td>
                      <td className="py-2 pr-2">${r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportTab === 'byCategory' && (
          <div className="bg-card rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Sales by Category</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-2">Category</th>
                    <th className="py-2 pr-2">Quantity</th>
                    <th className="py-2 pr-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((r, idx) => (
                    <tr key={`${r.category_id}-${idx}`} className="border-t">
                      <td className="py-2 pr-2">{r.name}</td>
                      <td className="py-2 pr-2">{r.quantity}</td>
                      <td className="py-2 pr-2">${r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportTab === 'byPayment' && (
          <div className="bg-card rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Sales by Payment Method</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-2">Method</th>
                    <th className="py-2 pr-2">Orders</th>
                    <th className="py-2 pr-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byPayment.map((r) => (
                    <tr key={r.method} className="border-t">
                      <td className="py-2 pr-2">{r.method}</td>
                      <td className="py-2 pr-2">{r.count}</td>
                      <td className="py-2 pr-2">${r.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
      <SaleDetailModal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        sale={selectedSale}
        customer={customers.find(c => c.id === selectedSale?.customer_id)}
        footerContent={
          <div className="flex gap-2 flex-wrap">
            {console.log('🔍 Footer Debug:', { 
              hasSelectedSale: !!selectedSale, 
              saleStatus: selectedSale?.status,
              hasHandlers: !!handlers,
              hasSalesHandler: !!handlers?.sales
            })}
            <Button 
              variant="outline" 
              onClick={handlePrintReceipt}
              size="sm"
            >
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            {selectedSale && (!selectedSale.status || (selectedSale.status !== 'voided' && selectedSale.status !== 'returned')) && handlers && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleVoidSale}
                  disabled={isProcessingVoid || isProcessingReturn}
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" /> 
                  {isProcessingVoid ? 'Voiding...' : 'Void Sale'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleProcessReturn}
                  disabled={isProcessingVoid || isProcessingReturn}
                  size="sm"
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> 
                  {isProcessingReturn ? 'Processing...' : 'Process Return'}
                </Button>
              </>
            )}
            {selectedSale && selectedSale.status === 'voided' && (
              <span className="text-sm text-red-600 font-medium px-3 py-2">
                ⚠️ This sale has been voided
              </span>
            )}
            {selectedSale && selectedSale.status === 'returned' && (
              <span className="text-sm text-orange-600 font-medium px-3 py-2">
                ↩️ This sale has been returned
              </span>
            )}
          </div>
        }
      />
      <div className="hidden">
        <Receipt ref={receiptRef} sale={selectedSale} settings={settings} />
      </div>
    </>
  );
};

export default ReportsView;