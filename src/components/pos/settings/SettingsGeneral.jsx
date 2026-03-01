
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { Upload, X, Plus, Trash2, DollarSign } from 'lucide-react';
import { DEFAULT_TILES } from '@/components/pos/pos-components/QuickAmountTiles';

const SettingsGeneral = ({ settings, onUpdate }) => {
  const { user } = useAuth();
  const [storeName, setStoreName] = useState(settings.storeName?.value || '');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress?.value || '');
  const [storeEmail, setStoreEmail] = useState(settings.storeEmail?.value || '');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl?.value || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [tiles, setTiles] = useState(settings.quickAmountTiles?.value || DEFAULT_TILES);
  const [newTileLabel, setNewTileLabel] = useState('');
  const [newTileAmount, setNewTileAmount] = useState('');

  const handleSave = () => {
    Promise.all([
      onUpdate({ key: 'storeName', value: storeName }),
      onUpdate({ key: 'storeAddress', value: storeAddress }),
      onUpdate({ key: 'storeEmail', value: storeEmail }),
      onUpdate({ key: 'quickAmountTiles', value: tiles }),
    ]).then(() => {
      toast({ title: "Store profile updated successfully!" });
    }).catch(err => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    });
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const filePath = `${user.id}/logo-${Date.now()}`;
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('store_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('store_assets')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      await onUpdate({ key: 'logoUrl', value: publicUrl });
      toast({ title: "Logo uploaded successfully!" });
    } catch (error) {
      toast({ title: "Logo Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeLogo = async () => {
    setLogoUrl(null);
    await onUpdate({ key: 'logoUrl', value: null });
    toast({ title: "Logo removed." });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Store Profile</h3>
        <p className="text-muted-foreground">Update your store's public information.</p>
      </div>
      <div className="space-y-4 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="storeName">Store Name</Label>
          <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storeAddress">Store Address</Label>
          <Input id="storeAddress" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storeEmail">Contact Email</Label>
          <Input id="storeEmail" type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold">Store Logo</h3>
        <p className="text-muted-foreground">Upload a logo to be displayed on invoices.</p>
      </div>
      <div className="flex items-center space-x-4">
        {logoUrl ? (
          <div className="relative">
            <img src={logoUrl} alt="Store Logo" className="h-20 w-auto object-contain rounded-md border p-2" />
            <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 w-6 h-6" onClick={removeLogo}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="w-32 h-20 border-2 border-dashed rounded-md flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No Logo</span>
          </div>
        )}
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          <Upload className="w-4 h-4 mr-2" /> {isUploading ? 'Uploading...' : 'Upload Logo'}
        </Button>
        <input type="file" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" accept="image/png, image/jpeg" />
      </div>

      {/* Quick Amount Tiles */}
      <div>
        <h3 className="text-xl font-semibold">Quick Amount Tiles</h3>
        <p className="text-muted-foreground">Configure quick-add buttons shown in the POS for adding custom amounts to the cart.</p>
      </div>
      <div className="space-y-3 max-w-lg">
        <div className="grid grid-cols-4 gap-2">
          {tiles.map((tile, idx) => (
            <div key={idx} className="relative group">
              <div className="border rounded-lg p-2 text-center bg-card">
                <p className="font-semibold text-sm">{tile.label}</p>
                <p className="text-xs text-muted-foreground">${tile.amount.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setTiles(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Label</Label>
            <Input
              placeholder="e.g. $5"
              value={newTileLabel}
              onChange={e => setNewTileLabel(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1 w-28">
            <Label className="text-xs">Amount ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={newTileAmount}
              onChange={e => setNewTileAmount(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => {
              const amt = parseFloat(newTileAmount);
              if (isNaN(amt) || amt <= 0) return;
              const label = newTileLabel.trim() || `$${amt.toFixed(2)}`;
              setTiles(prev => [...prev, { label, amount: amt }]);
              setNewTileLabel('');
              setNewTileAmount('');
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => setTiles(DEFAULT_TILES)}
        >
          Reset to defaults
        </Button>
      </div>

      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  );
};

export default SettingsGeneral;
