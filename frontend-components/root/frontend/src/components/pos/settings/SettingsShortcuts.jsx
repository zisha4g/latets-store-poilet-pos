import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SettingsShortcuts = () => {
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['Alt', 'P'], description: 'Go to Point of Sale' },
        { keys: ['Alt', 'I'], description: 'Go to Inventory' },
        { keys: ['Alt', 'C'], description: 'Go to Customers' },
        { keys: ['Alt', 'U'], description: 'Go to Purchasing' },
        { keys: ['Alt', 'S'], description: 'Go to Settings' },
      ]
    },
    {
      category: 'Point of Sale',
      items: [
        { keys: ['F2'], description: 'Focus search/barcode input' },
        { keys: ['Enter'], description: 'Find customer by phone' },
      ]
    },
    {
      category: 'Inventory',
      items: [
        { keys: ['F2'], description: 'Focus product search' },
        { keys: ['Ctrl', 'F'], description: 'Focus product search (alternative)' },
        { keys: ['Ctrl', 'S'], description: 'Save changes in edit mode' },
      ]
    }
  ];

  const KeyBadge = ({ keyName }) => (
    <Badge variant="outline" className="font-mono text-xs px-2 py-1">
      {keyName}
    </Badge>
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Keyboard Shortcuts</h3>
        <p className="text-muted-foreground">Learn the keyboard shortcuts to navigate and use the POS system efficiently.</p>
      </div>

      <div className="space-y-6">
        {shortcuts.map((category) => (
          <Card key={category.category}>
            <CardHeader>
              <CardTitle className="text-lg">{category.category}</CardTitle>
              <CardDescription>Shortcuts for {category.category.toLowerCase()} operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {category.items.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center space-x-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <KeyBadge keyName={key} />
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Use F2 to quickly focus the search input in any screen</li>
            <li>• After adding a product to cart, the search input automatically refocuses for the next item</li>
            <li>• In inventory edit mode, use Ctrl+S to save all changes at once</li>
            <li>• Alt key combinations work globally throughout the application</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsShortcuts;