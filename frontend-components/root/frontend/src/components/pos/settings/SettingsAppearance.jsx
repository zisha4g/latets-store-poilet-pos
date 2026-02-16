import React from 'react';
import { Button } from '@/components/ui/button';
import { themes } from '@/lib/themes';
import { Check, Monitor, Tablet } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const posLayouts = [
    { id: 'default', label: 'Default', description: 'Optimized for most screens.', icon: Monitor },
    { id: 'compact', label: 'Compact', description: 'Side-by-side view for wider screens.', icon: Tablet }
];

const SettingsAppearance = ({ settings, onUpdate }) => {
  const currentTheme = settings.theme?.value || 'light';
  const currentLayout = settings.posLayout?.value || 'default';

  const handleUpdate = (key, value) => {
    onUpdate({ key, value })
      .then(() => toast({ title: `Setting updated` }))
      .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Appearance</h3>
        <p className="text-muted-foreground">Customize the look and feel of your POS.</p>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">Theme</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {themes.map(theme => (
            <div key={theme.name}>
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col justify-center items-center relative"
                onClick={() => handleUpdate('theme', theme.name)}
              >
                <div className="w-16 h-8 rounded-md mb-2 flex items-center justify-center" style={{ backgroundColor: `hsl(${theme.colors['--primary']})` }}>
                  <div className="w-10 h-4 rounded-sm" style={{ backgroundColor: `hsl(${theme.colors['--secondary']})` }}></div>
                </div>
                <span className="text-sm">{theme.label}</span>
                {currentTheme === theme.name && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium">POS Layout</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posLayouts.map(layout => (
             <div 
                key={layout.id} 
                className={cn(
                    "p-4 border rounded-lg cursor-pointer transition-all",
                    currentLayout === layout.id ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50'
                )}
                onClick={() => handleUpdate('posLayout', layout.id)}
             >
                <div className="flex items-center space-x-3">
                    <layout.icon className="w-6 h-6 text-primary" />
                    <div>
                        <p className="font-medium">{layout.label}</p>
                        <p className="text-sm text-muted-foreground">{layout.description}</p>
                    </div>
                </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsAppearance;