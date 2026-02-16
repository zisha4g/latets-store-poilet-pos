import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid, PackageSearch, Truck, History,
  BarChart2, Settings, AlertTriangle, Package,
  Plus
} from 'lucide-react';
import PurchasingView from '../PurchasingView';
import InventoryView from '../InventoryView';
import StockHistory from './StockHistory';
import ProductReports from './ProductReports';

const InventoryLayout = ({ products = [], categories = [], vendors = [], handlers = {}, sales = [] }) => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all'); // 'all' | 'low' | 'out'

  const handleStatClick = (type) => {
    // Toggle behavior: clicking the active filter turns it off
    setActiveTab('catalog');
    setSearchQuery('');
    setInventoryFilter(prev => (prev === type ? 'all' : type));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 sm:p-6">
      {/* Compact Header with Stats */}
      <div className="flex-none space-y-3 mb-4">
        {/* Top bar with title - hidden on mobile since we see it in navbar */}
        <h2 className="text-2xl sm:text-3xl font-bold hidden sm:block">Inventory Management</h2>

        {/* Compact Stats Section - horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-3 pb-2 md:pb-0 scrollbar-hide">
          <Card className={`flex-shrink-0 w-32 sm:w-36 md:w-auto ${inventoryFilter === 'all' ? 'ring-0' : ''}`}>
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Products</p>
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold">{products.length}</h3>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => handleStatClick('low')} className={`flex-shrink-0 w-32 sm:w-36 md:w-auto cursor-pointer transition-colors ${inventoryFilter === 'low' ? 'ring-2 ring-yellow-500' : ''}`}>
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Low Stock</p>
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-yellow-600">
                  {products.filter(p => p.stock < 10).length}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => handleStatClick('out')} className={`flex-shrink-0 w-32 sm:w-36 md:w-auto cursor-pointer transition-colors ${inventoryFilter === 'out' ? 'ring-2 ring-red-500' : ''}`}>
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Out</p>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-red-600">
                  {products.filter(p => p.stock === 0).length}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-shrink-0 w-32 sm:w-36 md:w-auto">
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Value</p>
                  <BarChart2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-bold">
                  ${(products.reduce((sum, p) => sum + (p.price * p.stock), 0) / 1000).toFixed(1)}k
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - takes remaining height */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="flex-wrap h-auto md:h-10 mb-3 gap-1">
          <TabsTrigger value="catalog" className="flex-1 md:flex-none text-xs md:text-sm px-2 md:px-3">
            <LayoutGrid className="w-4 h-4 mr-1" />
            <span>Catalog</span>
          </TabsTrigger>
          <TabsTrigger value="purchasing" className="flex-1 md:flex-none text-xs md:text-sm px-2 md:px-3">
            <Truck className="w-4 h-4 mr-1" />
            <span>Purchase</span>
          </TabsTrigger>
          <TabsTrigger value="stock-control" className="flex-1 md:flex-none text-xs md:text-sm px-2 md:px-3">
            <PackageSearch className="w-4 h-4 mr-1" />
            <span>Stock</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 md:flex-none text-xs md:text-sm px-2 md:px-3">
            <History className="w-4 h-4 mr-1" />
            <span>History</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex-1 md:flex-none text-xs md:text-sm px-2 md:px-3">
            <BarChart2 className="w-4 h-4 mr-1" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="flex-1 overflow-hidden mt-0">
          <InventoryView 
            products={products} 
            categories={categories} 
            handlers={handlers}
            isEmbedded={true}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filterMode={inventoryFilter}
            onFilterModeChange={setInventoryFilter}
          />
        </TabsContent>

        <TabsContent value="purchasing" className="flex-1 overflow-hidden mt-0">
          <PurchasingView 
            products={products}
            vendors={vendors}
            handlers={handlers}
            isEmbedded={true}
          />
        </TabsContent>

        <TabsContent value="stock-control" className="flex-1 overflow-hidden mt-0">
          <div className="h-full p-4 overflow-auto">
            <h3 className="text-lg font-medium mb-4">Stock Control</h3>
            {/* Stock Control content */}
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden mt-0">
          <StockHistory products={products} sales={sales} />
        </TabsContent>

        <TabsContent value="reports" className="flex-1 overflow-hidden mt-0">
          <ProductReports products={products} sales={sales} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryLayout;