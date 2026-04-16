import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Users, Calendar,
  Truck, BarChart2, Banknote, Keyboard, Download
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SIDEBAR_MODULES = [
  { key: 'enableDashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'enablePOS',        icon: ShoppingCart,    label: 'POS' },
  { key: 'enableOrders',     icon: FileText,        label: 'Orders' },
  { key: 'enableInventory',  icon: Package,         label: 'Inventory' },
  { key: 'enableCustomers',  icon: Users,           label: 'Customers' },
  { key: 'enableCalendar',   icon: Calendar,        label: 'Calendar' },
  { key: 'enableInvoicing',  icon: FileText,        label: 'Invoices' },
  { key: 'enablePurchasing', icon: Truck,           label: 'Purchasing' },
  { key: 'enableReports',    icon: BarChart2,       label: 'Reports' },
  { key: 'enableAccounting', icon: Banknote,        label: 'Accounting' },
];

const SettingsModules = ({ settings, onUpdate }) => {
  const handleToggle = (key, currentValue) => {
    onUpdate({ key, value: !currentValue })
      .then(() => toast({ title: "Module setting updated" }))
      .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Sidebar Modules</h3>
        <p className="text-muted-foreground">Enable or disable each sidebar section independently.</p>
      </div>

      <div className="space-y-3 max-w-lg">
        {SIDEBAR_MODULES.map(({ key, icon: Icon, label }) => {
          const isEnabled = settings[key]?.value !== false;
          return (
            <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
              <Label htmlFor={`${key}-toggle`} className="flex items-center space-x-3 cursor-pointer">
                <Icon className="w-5 h-5 text-primary" />
                <span className="font-medium">{label}</span>
              </Label>
              <Switch
                id={`${key}-toggle`}
                checked={isEnabled}
                onCheckedChange={() => handleToggle(key, isEnabled)}
              />
            </div>
          );
        })}
      </div>

      {/* Virtual Keyboard */}
      <div>
        <h3 className="text-xl font-semibold">Virtual Keyboard</h3>
        <p className="text-muted-foreground mb-4">Touch-friendly on-screen keyboard for POS.</p>
        <div className="space-y-3 max-w-lg">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="virtual-keyboard-toggle" className="flex items-center space-x-3 cursor-pointer">
              <Keyboard className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium">Virtual Keyboard</div>
                <div className="text-xs text-muted-foreground">Enable touch-friendly keyboard</div>
              </div>
            </Label>
            <Switch
              id="virtual-keyboard-toggle"
              checked={settings.virtualKeyboard?.value !== false}
              onCheckedChange={() => handleToggle('virtualKeyboard', settings.virtualKeyboard?.value !== false)}
            />
          </div>
          {settings.virtualKeyboard?.value !== false && (
            <div className="ml-4 p-4 border rounded-lg bg-muted/30">
              <Label htmlFor="keyboard-theme" className="text-sm font-medium mb-2 block">Keyboard Theme</Label>
              <Select
                value={settings.keyboardTheme?.value || 'dark'}
                onValueChange={(value) => onUpdate({ key: 'keyboardTheme', value })
                  .then(() => toast({ title: "Keyboard theme updated" }))
                  .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }))}
              >
                <SelectTrigger id="keyboard-theme" className="w-48">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Desktop App Download */}
      {!window.electronAPI && (
        <div>
          <h3 className="text-xl font-semibold">Desktop App</h3>
          <p className="text-muted-foreground mb-4">Download StorePilot as a standalone desktop application.</p>
          <a
            href="https://github.com/zisha4g/latets-store-poilet-pos/releases/latest/download/StorePilot.Setup.0.0.0.exe"
            download
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <Download className="w-5 h-5" />
            Download Desktop App
          </a>
          <p className="text-xs text-muted-foreground mt-2">Windows installer • Auto-updates included</p>
        </div>
      )}
    </div>
  );
};

export default SettingsModules;