import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Package, DollarSign, Eye, Download } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ProductReports = ({ products = [], sales = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reportType, setReportType] = useState('performance'); // performance, revenue, turnover, margin
  const [sortBy, setSortBy] = useState('revenue'); // revenue, quantity, profit, name

  // Calculate product metrics
  const productMetrics = useMemo(() => {
    // Build metrics from products and sales
    
    const metrics = products.map(product => {
      // Find all sales for this product - handle both product_id and id fields
      const productSales = sales.flatMap(sale => {
        // Handle both nested items and direct product sales
        const saleItems = sale.items || [];
        return saleItems
          .filter(item => (item.product_id === product.id) || (item.id === product.id))
          .map(item => ({
            quantity: item.quantity || 0,
            price: item.price || 0,
            cost: item.cost_price || product.cost_price || 0,
            date: sale.date || sale.created_at || sale.timestamp,
          }));
      });

      const totalQuantitySold = productSales.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const totalRevenue = productSales.reduce((sum, s) => sum + ((s.quantity || 0) * (s.price || 0)), 0);
      const totalCost = productSales.reduce((sum, s) => sum + ((s.quantity || 0) * (s.cost || 0)), 0);
      const totalProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;

      // Calculate turnover (how fast product sells)
      const daysSinceFirstSale = productSales.length > 0
        ? Math.floor(
            (new Date() - new Date(productSales[0].date)) / (1000 * 60 * 60 * 24)
          ) || 1
        : 1;
      const turnoverRate = (totalQuantitySold / daysSinceFirstSale).toFixed(2);

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        currentStock: product.stock,
        price: product.price,
        costPrice: product.cost_price || 0,
        totalQuantitySold,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin),
        turnoverRate: parseFloat(turnoverRate),
        salesCount: productSales.length,
      };
    });

    return metrics.filter(m => m.totalQuantitySold > 0); // Only products with sales
  }, [products, sales]);

  // Filter and sort
  const filteredMetrics = useMemo(() => {
    let filtered = [...productMetrics];

    // Search
    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.sku && m.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Sort
    if (sortBy === 'revenue') {
      filtered.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (sortBy === 'quantity') {
      filtered.sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
    } else if (sortBy === 'profit') {
      filtered.sort((a, b) => b.totalProfit - a.totalProfit);
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [productMetrics, searchTerm, sortBy]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return filteredMetrics.slice(0, 10).map(m => ({
      name: m.name.substring(0, 15),
      revenue: m.totalRevenue,
      quantity: m.totalQuantitySold,
      profit: m.totalProfit,
      margin: m.profitMargin,
    }));
  }, [filteredMetrics]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    const totalRevenue = filteredMetrics.reduce((sum, m) => sum + m.totalRevenue, 0);
    const totalProfit = filteredMetrics.reduce((sum, m) => sum + m.totalProfit, 0);
    const totalQuantity = filteredMetrics.reduce((sum, m) => sum + m.totalQuantitySold, 0);
    const avgMargin = filteredMetrics.length > 0
      ? (filteredMetrics.reduce((sum, m) => sum + m.profitMargin, 0) / filteredMetrics.length).toFixed(2)
      : 0;

    return { totalRevenue, totalProfit, totalQuantity, avgMargin };
  }, [filteredMetrics]);

  const exportToCSV = () => {
    const headers = ['Product Name', 'SKU', 'Current Stock', 'Qty Sold', 'Total Revenue', 'Total Cost', 'Total Profit', 'Profit Margin %', 'Turnover Rate'];
    const rows = filteredMetrics.map(m => [
      m.name,
      m.sku || '',
      m.currentStock,
      m.totalQuantitySold,
      m.totalRevenue.toFixed(2),
      m.totalCost.toFixed(2),
      m.totalProfit.toFixed(2),
      m.profitMargin.toFixed(2),
      m.turnoverRate.toFixed(2),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <h3 className="text-2xl font-bold mt-2">${overallStats.totalRevenue.toFixed(2)}</h3>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <h3 className="text-2xl font-bold mt-2">${overallStats.totalProfit.toFixed(2)}</h3>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Qty Sold</p>
                <h3 className="text-2xl font-bold mt-2">{overallStats.totalQuantity}</h3>
              </div>
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Profit Margin</p>
                <h3 className="text-2xl font-bold mt-2">{overallStats.avgMargin}%</h3>
              </div>
              <Eye className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue">By Revenue</SelectItem>
            <SelectItem value="quantity">By Quantity</SelectItem>
            <SelectItem value="profit">By Profit</SelectItem>
            <SelectItem value="name">By Name</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Charts */}
      <div className="flex-1 grid grid-cols-2 gap-4 overflow-auto">
        {/* Revenue Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Product (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Profit Margin Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profit Margin by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Product Performance Details</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Product</th>
                  <th className="px-4 py-2 text-left font-medium">SKU</th>
                  <th className="px-4 py-2 text-right font-medium">Stock</th>
                  <th className="px-4 py-2 text-right font-medium">Qty Sold</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                  <th className="px-4 py-2 text-right font-medium">Profit</th>
                  <th className="px-4 py-2 text-right font-medium">Margin %</th>
                  <th className="px-4 py-2 text-right font-medium">Turnover</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMetrics.length > 0 ? (
                  filteredMetrics.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium">{m.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.sku || '—'}</td>
                      <td className="px-4 py-2 text-right">{m.currentStock}</td>
                      <td className="px-4 py-2 text-right">{m.totalQuantitySold}</td>
                      <td className="px-4 py-2 text-right">${m.totalRevenue.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">${m.totalCost.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        <span className={m.totalProfit > 0 ? 'text-green-600' : 'text-red-600'}>
                          ${m.totalProfit.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={m.profitMargin > 0 ? 'text-green-600' : 'text-red-600'}>
                          {m.profitMargin.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{m.turnoverRate}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-muted-foreground">
                      No products with sales found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductReports;
