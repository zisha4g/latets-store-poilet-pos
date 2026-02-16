import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';

const TaxItem = ({ tax, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTax, setEditedTax] = useState(tax);

  const handleSave = async () => {
    try {
      const rateStr = editedTax.rate.toString();
      await onUpdate({ ...editedTax, rate: Number(Number(rateStr).toFixed(3)) });
      setIsEditing(false);
      toast({ title: "Tax Updated" });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-secondary rounded-md">
      {isEditing ? (
        <>
          <div className="flex-grow flex items-center space-x-2 mr-2">
            <Input 
              placeholder="Tax Name" 
              value={editedTax.name} 
              onChange={e => setEditedTax({...editedTax, name: e.target.value})} 
            />
            <Input 
              type="number" 
              step="0.001"
              placeholder="Rate" 
              value={editedTax.rate || ''} 
              onChange={e => setEditedTax({...editedTax, rate: e.target.value})} 
              onBlur={e => {
                const value = Number(e.target.value);
                if (!isNaN(value)) {
                  // Convert to string first to maintain precision
                  const rateStr = value.toString();
                  const normalizedRate = Number(Number(rateStr).toFixed(3));
                  setEditedTax(prev => ({ ...prev, rate: normalizedRate }));
                }
              }}
              className="w-24"
            />
            <span>%</span>
            <div className="flex items-center space-x-2 bg-primary/5 p-2 rounded-lg">
              <input
                type="checkbox"
                id={`defaultTax-${tax.id}`}
                checked={editedTax.is_default}
                onChange={e => setEditedTax({...editedTax, is_default: e.target.checked})}
                className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
              />
              <Label htmlFor={`defaultTax-${tax.id}`} className="text-sm">Default Tax</Label>
            </div>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="icon" onClick={handleSave}><Save className="w-4 h-4 text-primary" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}><X className="w-4 h-4" /></Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center space-x-2">
              <p className="font-medium">{tax.name}</p>
              {tax.is_default && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {typeof tax.rate === 'string' ? 
                Number(tax.rate).toFixed(3) : 
                tax.rate.toFixed(3)
              }%
            </p>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="icon" onClick={() => { setEditedTax({...tax, rate: tax.rate}); setIsEditing(true); }}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(tax.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

const SettingsFinancials = ({ taxes, serviceCharges, handlers }) => {
  const [newTax, setNewTax] = useState({ name: '', rate: '', is_default: false });

  const handleAddTax = async () => {
    // Validate input
    if (!newTax.name || !newTax.rate) {
      toast({ title: "Missing Information", description: "Please provide both a name and a rate.", variant: "destructive" });
      return;
    }

    // Normalize the tax name to prevent case-sensitive duplicates
    const normalizedName = newTax.name.trim().toLowerCase();
    
    // Check for existing tax with same name
    const existingTax = taxes?.find(tax => tax.name.toLowerCase() === normalizedName);
    if (existingTax) {
      toast({ 
        title: "Duplicate Tax Name", 
        description: `A tax named "${existingTax.name}" already exists. Please use a different name.`, 
        variant: "destructive" 
      });
      return;
    }

    try {
      const rateStr = newTax.rate.toString();
      const rate = Number(Number(rateStr).toFixed(3));

      await handlers.taxes.add({ 
        name: newTax.name.trim(),
        rate,
        is_default: newTax.is_default 
      });
      
      setNewTax({ name: '', rate: '', is_default: false });
      toast({ title: "Tax Added", description: `${newTax.name} has been added with rate ${rate}%.` });
    } catch (error) {
      // Handle specific database errors
      if (error.code === '23505') {
        toast({ 
          title: "Duplicate Tax Name", 
          description: "A tax with this name already exists. Please use a different name.", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error Adding Tax", 
          description: "There was a problem adding the tax. Please try again.", 
          variant: "destructive" 
        });
      }
      console.error('Tax addition error:', error);
    }
  };

  const handleDeleteTax = async (id) => {
    try {
      await handlers.taxes.delete(id);
      toast({ title: "Tax Deleted" });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Financials</h3>
        <p className="text-muted-foreground">Manage taxes and service charges for your business.</p>
      </div>

      <div className="p-6 border rounded-lg">
        <h4 className="text-lg font-medium mb-4">Tax Rates</h4>
        <div className="space-y-4">
          {(taxes || []).map(tax => (
            <TaxItem key={tax.id} tax={tax} onUpdate={handlers.taxes.update} onDelete={handleDeleteTax} />
          ))}
        </div>
        <div className="mt-6 pt-6 border-t">
          <h5 className="font-medium mb-2">Add New Tax</h5>
          <div className="flex items-end space-x-2">
            <div className="flex-grow space-y-1">
              <Label htmlFor="taxName">Tax Name</Label>
              <Input id="taxName" placeholder="e.g., Sales Tax" value={newTax.name} onChange={e => setNewTax({ ...newTax, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="taxRate">Rate (%)</Label>
              <Input 
                id="taxRate" 
                type="number" 
                step="0.001" 
                placeholder="e.g., 8.375" 
                value={newTax.rate} 
                onChange={e => setNewTax({ ...newTax, rate: e.target.value })}
                onBlur={e => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    setNewTax(prev => ({ ...prev, rate: value.toFixed(3) }));
                  }
                }}
              />
            </div>
            <div className="flex-col space-y-1 mt-1">
              <div className="flex items-center space-x-2 bg-primary/5 p-2 rounded-lg">
                <input
                  type="checkbox"
                  id="newDefaultTax"
                  checked={newTax.is_default}
                  onChange={e => setNewTax({...newTax, is_default: e.target.checked})}
                  className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                />
                <Label htmlFor="newDefaultTax" className="text-sm">Set as Default</Label>
              </div>
            </div>
            <Button onClick={handleAddTax}><Plus className="w-4 h-4 mr-2" /> Add Tax</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsFinancials;