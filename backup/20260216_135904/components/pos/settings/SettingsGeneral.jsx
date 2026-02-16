
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { Upload, X } from 'lucide-react';

const SettingsGeneral = ({ settings, onUpdate }) => {
  const { user } = useAuth();
  const [storeName, setStoreName] = useState(settings.storeName?.value || '');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress?.value || '');
  const [storeEmail, setStoreEmail] = useState(settings.storeEmail?.value || '');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl?.value || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleSave = () => {
    Promise.all([
      onUpdate({ key: 'storeName', value: storeName }),
      onUpdate({ key: 'storeAddress', value: storeAddress }),
      onUpdate({ key: 'storeEmail', value: storeEmail }),
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

      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  );
};

export default SettingsGeneral;
