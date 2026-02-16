import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Package, ShoppingCart, AlertTriangle, PlusCircle, Users, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

const StatCard = ({ title, value, icon, color, description }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-xl sm:text-2xl font-bold">{value}</div>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{description}</p>
    </CardContent>
  </Card>
);

const DashboardView = ({ data }) => {
  const { products, sales, customers, settings } = data;
  const navigate = useNavigate();

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const salesToday = useMemo(() => sales.filter(sale => new Date(sale.timestamp) >= startOfToday), [sales]);
  const revenueToday = useMemo(() => salesToday.reduce((sum, sale) => sum + sale.total, 0), [salesToday]);

  const lowStockProducts = useMemo(() => {
    const lowStockThreshold = settings?.lowStockThreshold?.value || 10;
    return products.filter(p => p.stock <= lowStockThreshold);
  }, [products, settings]);

  const recentSales = useMemo(() => [...sales].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5), [sales]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  // Duplicate detection by phone or email
  const normalizePhone = (p) => (p || '').replace(/\D/g, '');
  const duplicateGroups = useMemo(() => {
    const byPhone = new Map();
    const byEmail = new Map();
    for (const c of customers) {
      const phone = normalizePhone(c.phone);
      if (phone && phone.length >= 7) {
        const arr = byPhone.get(phone) || [];
        arr.push(c);
        byPhone.set(phone, arr);
      }
      const email = (c.email || '').trim().toLowerCase();
      if (email) {
        const arr = byEmail.get(email) || [];
        arr.push(c);
        byEmail.set(email, arr);
      }
    }
    const groups = [];
    for (const [key, arr] of byPhone.entries()) if (arr.length > 1) groups.push({ type: 'phone', key, customers: arr });
    for (const [key, arr] of byEmail.entries()) if (arr.length > 1) groups.push({ type: 'email', key, customers: arr });
    return groups;
  }, [customers]);

  const [showDupBanner, setShowDupBanner] = useState(true);

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-3 sm:p-4 md:p-6 flex flex-col overflow-y-auto"
    >
      {showDupBanner && duplicateGroups.length > 0 && (
        <div className="mb-4 p-3 sm:p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Possible duplicate customers found</p>
              <p className="text-sm">{duplicateGroups.length} group(s) matched by phone/email. You can review and merge on the Customers page.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/app/customers')}>Review Duplicates</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDupBanner(false)}>Dismiss</Button>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-6 gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Dashboard</h1>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button 
            onClick={() => navigate('/app/pos')} 
            className="w-full sm:w-auto"
          >
            <ShoppingCart className="w-4 h-4 mr-2" /> New Sale
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/app/inventory')}
            className="w-full sm:w-auto"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

      <motion.div
        className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4 md:mb-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <StatCard
            title="Today's Revenue"
            value={`$${revenueToday.toFixed(2)}`}
            icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
            description={`${salesToday.length} sales today`}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Total Products"
            value={products.length}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            description="Across all categories"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Total Customers"
            value={customers.length}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            description="All registered customers"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatCard
            title="Low Stock Alerts"
            value={lowStockProducts.length}
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            description="Items needing attention"
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3 flex-grow overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg sm:text-xl">Recent Sales</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden pb-3">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-3 sm:space-y-4">
                  {recentSales.length > 0 ? recentSales.map(sale => (
                    <div key={sale.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-secondary">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">Sale #{sale.id.substring(0, 8)}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{new Date(sale.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="font-bold text-base sm:text-lg">${sale.total.toFixed(2)}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{sale.items.length} items</p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center text-muted-foreground py-10 text-sm">No recent sales.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-destructive" />
                Low Stock Items
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden pb-3">
              <ScrollArea className="h-full pr-3">
                <div className="space-y-2 sm:space-y-3">
                  {lowStockProducts.length > 0 ? lowStockProducts.map(product => (
                    <div key={product.id} className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium truncate pr-2 sm:pr-4">{product.name}</span>
                      <span className="font-bold text-destructive flex-shrink-0">{product.stock} left</span>
                    </div>
                  )) : (
                    <div className="text-center text-muted-foreground py-10 text-sm">Inventory is well-stocked!</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default DashboardView;