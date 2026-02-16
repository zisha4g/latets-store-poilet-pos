import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Edit, Save, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';

const FinancialsSettings = () => {
  const { user } = useAuth();
  const [taxes, setTaxes] = useState([]);
  const [serviceCharges, setServiceCharges] = useState([]);
  const [editingTax, setEditingTax] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);

  useEffect(() => {
    const fetchFinancials = async () => {
      if (!user) return;
      const [taxRes, chargeRes] = await Promise.all([
        supabase.from('taxes').select('*').eq('user_id', user.id),
        supabase.from('service_charges').select('*').eq('user_id', user.id),
      ]);
      if (taxRes.data) setTaxes(taxRes.data);
      if (chargeRes.data) setServiceCharges(chargeRes.data);
    };
    fetchFinancials();
  }, [user]);

  const handleSaveTax = async () => {
    if (!editingTax.name || editingTax.rate === undefined || editingTax.rate === '') {
      toast({ title: 'Error', description: 'Name and rate are required.', variant: 'destructive' });
      return;
    }
    
    // Parse the rate as a float with 3 decimal places precision
    const parsedRate = parseFloat(parseFloat(editingTax.rate).toFixed(3));
    
    const taxToSave = {
      ...editingTax,
      rate: parsedRate,
      user_id: user.id,
      is_default: editingTax.is_default || false
    };

    // If this is being set as default, unset any existing default tax
    if (taxToSave.is_default) {
      const currentDefault = taxes.find(t => t.is_default && t.id !== editingTax.id);
      if (currentDefault) {
        await supabase.from('taxes').update({ is_default: false }).eq('id', currentDefault.id);
      }
    }

    const { data, error } = await supabase.from('taxes').upsert(taxToSave).select().single();
    if (error) {
      toast({ title: 'Error saving tax', description: error.message, variant: 'destructive' });
    } else {
      setTaxes(prev => editingTax.id ? prev.map(t => t.id === data.id ? data : t) : [...prev, data]);
      setEditingTax(null);
      toast({ title: 'Tax saved successfully' });
    }
  };

  const handleDeleteTax = async (id) => {
    await supabase.from('taxes').delete().eq('id', id);
    setTaxes(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Tax deleted' });
  };
  
  const handleSaveCharge = async () => {
    if (!editingCharge.name || !editingCharge.value) {
      toast({ title: 'Error', description: 'Name and value are required.', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.from('service_charges').upsert(editingCharge).select().single();
    if (error) {
      toast({ title: 'Error saving charge', description: error.message, variant: 'destructive' });
    } else {
      setServiceCharges(prev => editingCharge.id ? prev.map(c => c.id === data.id ? data : c) : [...prev, data]);
      setEditingCharge(null);
      toast({ title: 'Service charge saved' });
    }
  };

  const handleDeleteCharge = async (id) => {
    await supabase.from('service_charges').delete().eq('id', id);
    setServiceCharges(prev => prev.filter(c => c.id !== id));
    toast({ title: 'Service charge deleted' });
  };

  const renderTaxRow = (tax) => (
    <div key={tax.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
      <div className="flex items-center space-x-2">
        <p>{tax.name} ({Number(tax.rate).toFixed(3)}%)</p>
        {tax.is_default && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Default</span>
        )}
      </div>
      <div className="flex space-x-2">
        <Button variant="ghost" size="icon" onClick={() => setEditingTax(tax)}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteTax(tax.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
      </div>
    </div>
  );

  const renderChargeRow = (charge) => (
    <div key={charge.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
      <p>{charge.name} ({charge.type === 'fixed' ? `$${charge.value}` : `${charge.value}%`})</p>
      <div>
        <Button variant="ghost" size="icon" onClick={() => setEditingCharge(charge)}><Edit className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteCharge(charge.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Tax Rates</CardTitle>
          <CardDescription>Manage your store's tax rates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {taxes.map(renderTaxRow)}
          {editingTax && (
            <div className="p-4 border rounded-lg space-y-4">
              <h4 className="font-semibold">{editingTax.id ? 'Edit Tax' : 'Add New Tax'}</h4>
              <div className="space-y-4">
                <div>
                  <Label>Tax Name</Label>
                  <Input placeholder="Tax Name (e.g., Sales Tax)" value={editingTax.name} onChange={e => setEditingTax({...editingTax, name: e.target.value})} />
                </div>
                <div>
                  <Label>Rate (%)</Label>
                  <Input 
                    type="number" 
                    placeholder="Rate (e.g., 8.375)" 
                    value={editingTax.rate} 
                    onChange={e => setEditingTax({...editingTax, rate: e.target.value})}
                    step="0.001"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <div className="flex items-center space-x-2 bg-primary/5 p-3 rounded-lg w-full">
                    <input 
                      type="checkbox"
                      id="defaultTax"
                      checked={editingTax.is_default}
                      onChange={e => setEditingTax({...editingTax, is_default: e.target.checked})}
                      className="h-5 w-5 rounded border-primary text-primary focus:ring-primary"
                    />
                    <Label htmlFor="defaultTax" className="font-medium">Set as Default Tax Rate</Label>
                    <div className="text-sm text-muted-foreground ml-2">(Will be automatically applied to new items)</div>
                  </div>
                  <Label htmlFor="defaultTax">Set as default sales tax</Label>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="ghost" onClick={() => setEditingTax(null)}><X className="w-4 h-4 mr-2"/>Cancel</Button>
                <Button onClick={handleSaveTax}><Save className="w-4 h-4 mr-2"/>Save</Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!editingTax && <Button onClick={() => setEditingTax({ name: '', rate: '', user_id: user.id })}><Plus className="w-4 h-4 mr-2"/>Add Tax</Button>}
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Service Charges</CardTitle>
          <CardDescription>Manage additional fees and charges.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {serviceCharges.map(renderChargeRow)}
          {editingCharge && (
            <div className="p-4 border rounded-lg space-y-4">
              <h4 className="font-semibold">{editingCharge.id ? 'Edit Charge' : 'Add New Charge'}</h4>
              <Input placeholder="Charge Name (e.g., Delivery Fee)" value={editingCharge.name} onChange={e => setEditingCharge({...editingCharge, name: e.target.value})} />
              <select value={editingCharge.type || 'fixed'} onChange={e => setEditingCharge({...editingCharge, type: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="fixed">Fixed ($)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
              <Input type="number" placeholder="Value" value={editingCharge.value} onChange={e => setEditingCharge({...editingCharge, value: e.target.value})} />
              <div className="flex justify-end space-x-2">
                <Button variant="ghost" onClick={() => setEditingCharge(null)}><X className="w-4 h-4 mr-2"/>Cancel</Button>
                <Button onClick={handleSaveCharge}><Save className="w-4 h-4 mr-2"/>Save</Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!editingCharge && <Button onClick={() => setEditingCharge({ name: '', type: 'fixed', value: '', user_id: user.id })}><Plus className="w-4 h-4 mr-2"/>Add Service Charge</Button>}
        </CardFooter>
      </Card>
    </div>
  );
};

export default FinancialsSettings;