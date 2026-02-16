import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';

const IVRModal = ({ menu, onSave, onClose, audioFiles, extensions, ivrMenus }) => {
  const [name, setName] = useState(menu?.name || '');
  const [promptAudioId, setPromptAudioId] = useState(menu?.prompt_audio_id || '');
  const [options, setOptions] = useState(menu?.options || []);

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...options];
    newOptions[index][field] = value;
    if (field === 'action_type') {
      newOptions[index].action_value = '';
    }
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, { key: '', action_type: '', action_value: '' }]);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };
  
  const handleSave = () => {
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    onSave({ ...menu, name, prompt_audio_id: promptAudioId, options });
  };
  
  const renderActionValueInput = (option, index) => {
    switch (option.action_type) {
      case 'forward_to_extension':
        return (
          <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder="Select Extension" /></SelectTrigger>
            <SelectContent>{extensions.map(e => <SelectItem key={e.id} value={e.id}>{e.extension_number} - {e.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'go_to_menu':
        return (
          <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder="Select Menu" /></SelectTrigger>
            <SelectContent>{ivrMenus.filter(m => m.id !== menu.id).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'play_audio':
        return (
           <Select value={option.action_value} onValueChange={val => handleOptionChange(index, 'action_value', val)}>
            <SelectTrigger><SelectValue placeholder="Select Audio File" /></SelectTrigger>
            <SelectContent>{audioFiles.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      default:
        return <Input disabled placeholder="Select an action type first" />;
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{menu?.id ? 'Edit' : 'Create'} IVR Menu</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
        <div className="space-y-2">
          <Label htmlFor="ivr-name">Menu Name</Label>
          <Input id="ivr-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Main Menu" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ivr-prompt">Welcome Prompt</Label>
          <Select value={promptAudioId} onValueChange={setPromptAudioId}>
            <SelectTrigger><SelectValue placeholder="Select an audio file" /></SelectTrigger>
            <SelectContent>{audioFiles.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Menu Options</Label>
          <div className="space-y-3 mt-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 p-3 border rounded-lg">
                <GripVertical className="w-5 h-5 text-muted-foreground" />
                <Input placeholder="Key" value={opt.key} onChange={e => handleOptionChange(i, 'key', e.target.value)} className="w-16" />
                <Select value={opt.action_type} onValueChange={val => handleOptionChange(i, 'action_type', val)}>
                  <SelectTrigger><SelectValue placeholder="Select Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forward_to_extension">Forward to Extension</SelectItem>
                    <SelectItem value="go_to_menu">Go to another IVR</SelectItem>
                    <SelectItem value="play_audio">Play Audio & Hang Up</SelectItem>
                    <SelectItem value="voicemail">Go to Voicemail</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-grow">{renderActionValueInput(opt, i)}</div>
                <Button variant="ghost" size="icon" onClick={() => removeOption(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
            <Button variant="outline" onClick={addOption} className="w-full">Add Option</Button>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save Menu</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const IVRManager = ({ ivrMenus, audioFiles, extensions, handlers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);

  const handleSave = async (menu) => {
    try {
      if (menu.id) {
        await handlers.update(menu);
        toast({ title: 'Success', description: 'IVR Menu updated.' });
      } else {
        await handlers.add(menu);
        toast({ title: 'Success', description: 'IVR Menu created.' });
      }
      setIsModalOpen(false);
      setSelectedMenu(null);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this IVR menu?')) {
      try {
        await handlers.delete(id);
        toast({ title: 'Success', description: 'IVR Menu deleted.' });
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>IVR Menus</CardTitle>
          <CardDescription>Create and manage interactive voice response menus.</CardDescription>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedMenu({ options: [] })}>
              <Plus className="w-4 h-4 mr-2" /> Create IVR Menu
            </Button>
          </DialogTrigger>
          {isModalOpen && <IVRModal menu={selectedMenu} onSave={handleSave} onClose={() => setIsModalOpen(false)} audioFiles={audioFiles} extensions={extensions} ivrMenus={ivrMenus} />}
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <div className="grid grid-cols-3 font-semibold border-b bg-muted/50 p-3">
            <span>Name</span>
            <span>Prompt Audio</span>
            <span>Actions</span>
          </div>
          {ivrMenus.map(menu => (
            <div key={menu.id} className="grid grid-cols-3 items-center p-3 border-b last:border-b-0">
              <span className="font-medium">{menu.name}</span>
              <span className="text-muted-foreground">{audioFiles.find(f => f.id === menu.prompt_audio_id)?.name || 'None'}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => { setSelectedMenu(menu); setIsModalOpen(true); }}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="destructive" size="icon" onClick={() => handleDelete(menu.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {ivrMenus.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No IVR menus created yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IVRManager;