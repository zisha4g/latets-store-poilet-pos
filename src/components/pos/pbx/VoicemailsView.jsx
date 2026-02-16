import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Trash2, Mail, MailOpen } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const VoicemailsView = ({ voicemails, handlers }) => {
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
          <div className="grid grid-cols-[1fr,1fr,80px,250px,100px] p-3 font-semibold border-b bg-muted/50">
            <span>From</span>
            <span>Received</span>
            <span>Duration</span>
            <span>Recording</span>
            <span>Actions</span>
          </div>
          <ScrollArea className="flex-grow">
            {voicemails.map(vm => (
              <div key={vm.id} className={`grid grid-cols-[1fr,1fr,80px,250px,100px] p-3 border-b last:border-b-0 items-center ${vm.is_new ? 'font-bold bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <span>{vm.from_number}</span>
                <span>{new Date(vm.created_at).toLocaleString()}</span>
                <span>{formatDuration(vm.duration_seconds)}</span>
                <td>
                  <audio controls src={vm.recording_url} className="h-10 w-full" />
                </td>
                <td className="flex gap-2 justify-center">
                  <Button variant="ghost" size="icon" onClick={() => toggleIsNew(vm)}>
                    {vm.is_new ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(vm.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
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