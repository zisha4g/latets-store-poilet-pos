import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, Mail, MailOpen, PhoneCall, Headphones } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useSoftphone } from '@/contexts/SoftphoneContext';
import CallButtons from './CallButtons';

const formatPhone = (raw) => {
  if (!raw) return '—';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

const VoicemailsView = ({ voicemails, handlers }) => {
  const { status: softphoneStatus, dial } = useSoftphone();

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this voicemail?')) {
      try {
        await handlers.delete(id);
        toast({ title: 'Voicemail deleted' });
      } catch (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const toggleIsNew = async (voicemail) => {
    try {
      await handlers.update(voicemail.id, { is_new: !voicemail.is_new });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Voicemails</CardTitle>
        <CardDescription>Listen to and manage your voicemails.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <div className="border rounded-lg h-full flex flex-col">
          <div className="grid grid-cols-[1.2fr,1fr,80px,250px,180px] p-3 font-semibold border-b bg-muted/50">
            <span>From</span>
            <span>Received</span>
            <span>Duration</span>
            <span>Recording</span>
            <span className="text-center">Actions</span>
          </div>
          <ScrollArea className="flex-grow">
            {voicemails.map(vm => (
              <div key={vm.id} className={`grid grid-cols-[1.2fr,1fr,80px,250px,180px] p-3 border-b last:border-b-0 items-center ${vm.is_new ? 'font-bold bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{formatPhone(vm.from_number)}</span>
                  <CallButtons phone={vm.from_number} />
                </div>
                <span>{new Date(vm.created_at).toLocaleString()}</span>
                <span>{formatDuration(vm.duration_seconds)}</span>
                <div>
                  <audio controls src={vm.recording_url} className="h-10 w-full" />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="ghost" size="icon" onClick={() => toggleIsNew(vm)} title={vm.is_new ? 'Mark as read' : 'Mark as new'}>
                    {vm.is_new ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(vm.id)} title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {voicemails.length === 0 && (
              <p className="p-4 text-center text-muted-foreground">No voicemails found.</p>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoicemailsView;