import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, Download, Filter, TrendingUp, TrendingDown, 
  Package, Clock, Calendar, ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const StockHistory = ({ products = [], sales = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, increase, decrease
  const [sortBy, setSortBy] = useState('recent'); // recent, product, quantity
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Generate stock movement history from sales
  const stockHistory = useMemo(() => {
    const movements = [];
    
  // Build stock movement from sales and products
    
    // Group sales by product
    const salesByProduct = {};
    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          // Handle both product_id and id fields
          const productId = item.product_id || item.id;
          
          if (!salesByProduct[productId]) {
            salesByProduct[productId] = [];
          }
          salesByProduct[productId].push({
            type: 'sale',
            quantity: -(item.quantity || 0),
            date: sale.date || sale.created_at || sale.timestamp,
            reference: `Sale #${sale.id?.slice(0, 8)}`,
            price: item.price || 0,
            total: (item.quantity || 0) * (item.price || 0),
          });
        });
      }
    });

    // Convert to array and flatten
    Object.entries(salesByProduct).forEach(([productId, productSales]) => {
      productSales.forEach(sale => {
        const product = products.find(p => p.id === productId);
        if (product) {
          movements.push({
            productId,
            productName: product.name,
            sku: product.sku,
            ...sale,
          });
        }
      });
    });    return movements.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sales, products]);

  // Filter and sort
  const filteredHistory = useMemo(() => {
    let filtered = [...stockHistory];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (filterType === 'decrease') {
      filtered = filtered.filter(item => item.quantity < 0);
    } else if (filterType === 'increase') {
      filtered = filtered.filter(item => item.quantity > 0);
    }

    // Product filter
    if (selectedProduct) {
      filtered = filtered.filter(item => item.productId === selectedProduct);
    }

    // Sort
    if (sortBy === 'product') {
      filtered.sort((a, b) => a.productName.localeCompare(b.productName));
    } else if (sortBy === 'quantity') {
      filtered.sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity));
    }
    // Default is 'recent' which is already sorted

    return filtered;
  }, [stockHistory, searchTerm, filterType, selectedProduct, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalMovements = filteredHistory.length;
    const totalQuantitySold = Math.abs(
      filteredHistory
        .filter(m => m.type === 'sale')
        .reduce((sum, m) => sum + m.quantity, 0)
    );
    const totalRevenue = filteredHistory
      .filter(m => m.type === 'sale')
      .reduce((sum, m) => sum + m.total, 0);

    return { totalMovements, totalQuantitySold, totalRevenue };
  }, [filteredHistory]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportToCSV = () => {
    const headers = ['Product Name', 'SKU', 'Type', 'Quantity', 'Date', 'Reference'];
    const rows = filteredHistory.map(item => [
      item.productName,
      item.sku || '',
      item.type,
      item.quantity,
      formatDate(item.date),
      item.reference,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Movements</p>
                <h3 className="text-2xl font-bold mt-2">{stats.totalMovements}</h3>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Quantity Sold</p>
                <h3 className="text-2xl font-bold mt-2">{stats.totalQuantitySold}</h3>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <h3 className="text-2xl font-bold mt-2">${stats.totalRevenue.toFixed(2)}</h3>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search product name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Movements</SelectItem>
            <SelectItem value="decrease">Stock Decrease</SelectItem>
            <SelectItem value="increase">Stock Increase</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="product">Product Name</SelectItem>
            <SelectItem value="quantity">Quantity</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* History Table */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Product</th>
              <th className="px-4 py-2 text-left font-medium">SKU</th>
              <th className="px-4 py-2 text-center font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">Quantity</th>
              <th className="px-4 py-2 text-right font-medium">Unit Price</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-left font-medium">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <button
                      onClick={() =>
                        setSelectedProduct(selectedProduct === item.productId ? null : item.productId)
                      }
                      className="text-left hover:underline font-medium"
                    >
                      {item.productName}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{item.sku || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.quantity < 0 ? (
                        <ArrowDownLeft className="w-4 h-4 text-red-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-green-600" />
                      )}
                      <span className={item.quantity < 0 ? 'text-red-600' : 'text-green-600'}>
                        {Math.abs(item.quantity)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">${item.price?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-2 text-right font-medium">${item.total?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(item.date)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{item.reference}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-muted-foreground">
                  No stock movements found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockHistory;
