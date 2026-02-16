import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { themes } from '@/lib/themes';

const AppearanceSettings = ({ settings, onUpdate }) => {
  const currentTheme = settings.theme?.value || 'light';

  const handleThemeChange = (themeName) => {
    onUpdate('theme', themeName)
      .then(() => toast({ title: "Theme updated successfully!" }))
      .catch(err => toast({ title: "Error", description: err.message, variant: "destructive" }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select a theme for your application.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.keys(themes).map(themeName => (
              <div key={themeName}>
                <Button
                  variant={currentTheme === themeName ? 'default' : 'outline'}
                  className="w-full h-24 flex flex-col items-start justify-between p-4"
                  onClick={() => handleThemeChange(themeName)}
                >
                  <span className="capitalize">{themeName}</span>
                  <div className="flex space-x-2">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `hsl(${themes[themeName]['--primary']})` }} />
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `hsl(${themes[themeName]['--secondary']})` }} />
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `hsl(${themes[themeName]['--background']})`, border: '1px solid black' }} />
                  </div>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppearanceSettings;