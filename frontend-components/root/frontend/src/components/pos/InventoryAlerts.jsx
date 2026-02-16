import React from 'react';
import { AlertTriangle, TrendingDown, ArrowUpRight, Package } from 'lucide-react';

const InventoryAlerts = ({ products }) => {
  const getAlertStats = () => {
    const lowStock = products.filter(p => p.stock < 10).length;
    const outOfStock = products.filter(p => p.stock === 0).length;
    const highValue = products.filter(p => p.price > 100).length;
    const totalItems = products.length;

    return { lowStock, outOfStock, highValue, totalItems };
  };

  const stats = getAlertStats();

  const alerts = [
    {
      title: "Low Stock Items",
      value: stats.lowStock,
      icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
      color: "bg-yellow-50 dark:bg-yellow-900/20",
      textColor: "text-yellow-700 dark:text-yellow-300"
    },
    {
      title: "Out of Stock",
      value: stats.outOfStock,
      icon: <TrendingDown className="w-5 h-5 text-red-500" />,
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-700 dark:text-red-300"
    },
    {
      title: "High Value Items",
      value: stats.highValue,
      icon: <ArrowUpRight className="w-5 h-5 text-green-500" />,
      color: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-700 dark:text-green-300"
    },
    {
      title: "Total Products",
      value: stats.totalItems,
      icon: <Package className="w-5 h-5 text-blue-500" />,
      color: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-700 dark:text-blue-300"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {alerts.map((alert, index) => (
        <div key={index} className={`p-4 rounded-lg ${alert.color} flex items-center justify-between`}>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{alert.title}</p>
            <p className={`text-2xl font-bold ${alert.textColor}`}>{alert.value}</p>
          </div>
          {alert.icon}
        </div>
      ))}
    </div>
  );
};

export default InventoryAlerts;