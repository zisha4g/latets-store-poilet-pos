import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PBXSettings = ({ settings, onUpdate, pbxData }) => {
  const { ivrMenus, audioFiles } = pbxData;
  const [mainPhoneNumber, setMainPhoneNumber] = useState(settings.pbxMainPhoneNumber?.value || '');
  const [mainIvrMenuId, setMainIvrMenuId] = useState(settings.pbxMainIvrMenuId?.value || '');
  const [afterHoursAction, setAfterHoursAction] = useState(settings.pbxAfterHoursAction?.value?.type || 'play_audio');
  const [afterHoursValue, setAfterHoursValue] = useState(settings.pbxAfterHoursAction?.value?.id || '');

  const handleSave = () => {
    Promise.all([
      onUpdate('pbxMainPhoneNumber', mainPhoneNumber),
      onUpdate('pbxMainIvrMenuId', mainIvrMenuId),
      onUpdate('pbxAfterHoursAction', { type: afterHoursAction, id: afterHoursValue }),
    ]).then(() => {
      toast({ title: "PBX settings updated successfully!" });
    }).catch(err => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    });
  };
  
  const renderActionValueInput = () => {
    switch (afterHoursAction) {
      case 'go_to_ivr':
        return (
          <Select value={afterHoursValue} onValueChange={setAfterHoursValue}>
            <SelectTrigger><SelectValue placeholder="Select IVR Menu" /></SelectTrigger>
            <SelectContent>{ivrMenus.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'play_audio':
        return (
           <Select value={afterHoursValue} onValueChange={setAfterHoursValue}>
            <SelectTrigger><SelectValue placeholder="Select Audio File" /></SelectTrigger>
            <SelectContent>{audioFiles.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };


  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">PBX General Settings</h3>
        <p className="text-muted-foreground">Configure the core settings for your phone system.</p>
      </div>
      <div className="space-y-4 max-w-lg">
        <div className="space-y-2">
          <Label htmlFor="mainPhoneNumber">Main Business Phone Number (Twilio)</Label>
          <Input id="mainPhoneNumber" value={mainPhoneNumber} onChange={(e) => setMainPhoneNumber(e.target.value)} placeholder="Enter your main Twilio number" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mainIvrMenu">Main IVR for Incoming Calls</Label>
          <Select value={mainIvrMenuId} onValueChange={setMainIvrMenuId}>
            <SelectTrigger><SelectValue placeholder="Select the main IVR menu" /></SelectTrigger>
            <SelectContent>{ivrMenus.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <Label>After-Hours Call Handling</Label>
          <p className="text-sm text-muted-foreground mb-2">What should happen when someone calls outside of business hours?</p>
          <div className="flex gap-2">
            <Select value={afterHoursAction} onValueChange={(val) => { setAfterHoursAction(val); setAfterHoursValue(''); }}>
              <SelectTrigger className="w-1/2"><SelectValue placeholder="Select Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="play_audio">Play an Audio Message</SelectItem>
                <SelectItem value="go_to_ivr">Go to an IVR Menu</SelectItem>
                <SelectItem value="voicemail">Go Straight to Voicemail</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-1/2">
                {renderActionValueInput()}
            </div>
          </div>
        </div>
      </div>
      <Button onClick={handleSave}>Save PBX Settings</Button>
    </div>
  );
};

export default PBXSettings;