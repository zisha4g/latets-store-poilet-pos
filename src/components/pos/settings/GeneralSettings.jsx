import React, { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Upload } from 'lucide-react';

const GeneralSettings = ({ settings, onUpdate }) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const logoUrl = settings?.store_logo?.value;

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({ title: "File too large", description: "Logo should be under 2MB.", variant: "destructive" });
      return;
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      await onUpdate('store_logo', publicUrl);
      toast({ title: 'Logo updated successfully!' });

    } catch (error) {
      toast({ title: "Error uploading logo", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Store Logo</CardTitle>
          <CardDescription>Upload your company logo. This will appear on invoices and receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-secondary rounded-lg flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="object-contain w-full h-full" />
              ) : (
                <span className="text-muted-foreground text-sm">No Logo</span>
              )}
            </div>
            <div>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Upload Logo
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleLogoUpload} />
              <p className="text-xs text-muted-foreground mt-2">PNG or JPG, max 2MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>Enable or disable major features of the application.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Module toggles could go here if needed, but they are in the sidebar logic for now */}
            <p className="text-muted-foreground">Module visibility is managed via the main sidebar for a cleaner experience.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeneralSettings;