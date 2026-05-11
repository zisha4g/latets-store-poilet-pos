import React from 'react';
import { Headphones, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useSoftphone } from '@/contexts/SoftphoneContext';

const formatPhone = (raw) => {
  if (!raw) return '';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

// Two icon buttons:
//   🎧  call from browser softphone (instant, headset)
//   📞  ring my desk phone, then bridge to the target
//
// Both stop click propagation so they can be embedded inside clickable
// table rows / cards without triggering row navigation.
const CallButtons = ({ phone, size = 'icon', className = '' }) => {
  const { status: softphoneStatus, dial } = useSoftphone();

  if (!phone) return null;

  const stop = (e) => { e.stopPropagation(); e.preventDefault(); };

  const callBrowser = async (e) => {
    stop(e);
    if (softphoneStatus !== 'registered') {
      toast({
        title: 'Browser softphone not connected',
        description: 'Use the desk-phone option instead.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await dial(phone);
      toast({ title: 'Calling…', description: formatPhone(phone) });
    } catch (err) {
      toast({ title: 'Call failed', description: err.message, variant: 'destructive' });
    }
  };

  const callDesk = async (e) => {
    stop(e);
    try {
      const { data, error } = await supabase.functions.invoke('pbx-click-to-call', {
        body: { to: phone },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to start callback');
      toast({
        title: 'Your phone is ringing',
        description: `Pick up to be connected to ${formatPhone(phone)}.`,
      });
    } catch (err) {
      toast({ title: 'Call failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <span className={`inline-flex gap-1 ${className}`}>
      <Button
        variant="ghost"
        size={size}
        title="Call from browser softphone"
        onClick={callBrowser}
      >
        <Headphones className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size={size}
        title="Call from desk phone (rings your phone, then dials)"
        onClick={callDesk}
      >
        <PhoneCall className="w-4 h-4" />
      </Button>
    </span>
  );
};

export default CallButtons;
