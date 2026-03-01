import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { FileText, Calculator, Keyboard, Monitor, Download } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SettingsModules = ({ settings, onUpdate }) => {
  const handleToggle = (key, value) => {
    onUpdate({ key, value: !value })
      .then(() => toast({ title: "Module setting updated" }))
      .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Modules</h3>
        <p className="text-muted-foreground">Enable or disable major features of the application.</p>
      </div>
      <div className="space-y-6 max-w-lg">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <Label htmlFor="invoicing-toggle" className="flex items-center space-x-3 cursor-pointer">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-medium">Invoicing Module</span>
          </Label>
          <Switch
            id="invoicing-toggle"
            checked={settings.enableInvoicing?.value}
            onCheckedChange={() => handleToggle('enableInvoicing', settings.enableInvoicing?.value)}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <Label htmlFor="accounting-toggle" className="flex items-center space-x-3 cursor-pointer">
            <Calculator className="w-5 h-5 text-primary" />
            <span className="font-medium">Accounting Module</span>
          </Label>
          <Switch
            id="accounting-toggle"
            checked={settings.enableAccounting?.value}
            onCheckedChange={() => handleToggle('enableAccounting', settings.enableAccounting?.value)}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <Label htmlFor="touch-mode-toggle" className="flex items-center space-x-3 cursor-pointer">
            <Monitor className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">Touch Mode POS</div>
              <div className="text-xs text-muted-foreground">Tablet-optimized POS with large buttons &amp; built-in keyboard</div>
            </div>
          </Label>
          <Switch
            id="touch-mode-toggle"
            checked={settings.touchMode?.value === true}
            onCheckedChange={() => handleToggle('touchMode', settings.touchMode?.value === true)}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <Label htmlFor="virtual-keyboard-toggle" className="flex items-center space-x-3 cursor-pointer">
            <Keyboard className="w-5 h-5 text-primary" />
            <div>
              <div className="font-medium">Virtual Keyboard</div>
              <div className="text-xs text-muted-foreground">Touch-friendly on-screen keyboard for POS</div>
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

      {/* Desktop App Download */}
      {!window.electronAPI && (
        <div className="mt-8">
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