import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

const ExtensionModal = ({ extension, onSave, onClose }) => {
  const [name, setName] = useState(extension?.name || '');
  const [number, setNumber] = useState(extension?.extension_number || '');
  const [email, setEmail] = useState(extension?.email_for_voicemail || '');

  const handleSave = () => {
    if (!name || !number) {
      toast({ title: 'Missing fields', description: 'Name and extension number are required.', variant: 'destructive' });
      return;
    }
    onSave({ ...extension, name, extension_number: parseInt(number, 10), email_for_voicemail: email });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{extension?.id ? 'Edit' : 'Add'} Extension</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="ext-name">Name</Label>
          <Input id="ext-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sales Department" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ext-number">Extension Number</Label>
          <Input id="ext-number" type="number" value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g., 101" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ext-email">Voicemail Email</Label>
          <Input id="ext-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Send voicemails to this email" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const ExtensionsManager = ({ extensions, handlers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(null);

  const handleSave = async (ext) => {
    try {
      if (ext.id) {
        await handlers.update(ext);
        toast({ title: 'Success', description: 'Extension updated.' });
      } else {
        await handlers.add(ext);
        toast({ title: 'Success', description: 'Extension created.' });
      }
      setIsModalOpen(false);
      setSelectedExtension(null);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this extension?')) {
      try {
        await handlers.delete(id);
        toast({ title: 'Success', description: 'Extension deleted.' });
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Extensions</CardTitle>
          <CardDescription>Manage internal phone extensions for your team.</CardDescription>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedExtension({})}>
              <Plus className="w-4 h-4 mr-2" /> Add Extension
            </Button>
          </DialogTrigger>
          {isModalOpen && <ExtensionModal extension={selectedExtension} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <div className="grid grid-cols-4 font-semibold border-b bg-muted/50 p-3">
            <span>Name</span>
            <span>Extension</span>
            <span>Voicemail Email</span>
            <span>Actions</span>
          </div>
          {extensions.map(ext => (
            <div key={ext.id} className="grid grid-cols-4 items-center p-3 border-b last:border-b-0">
              <span className="font-medium">{ext.name}</span>
              <span>{ext.extension_number}</span>
              <span className="text-muted-foreground">{ext.email_for_voicemail || 'Not set'}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => { setSelectedExtension(ext); setIsModalOpen(true); }}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => handleDelete(ext.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {extensions.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No extensions created yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExtensionsManager;