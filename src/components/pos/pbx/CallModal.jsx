import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Phone, PhoneOff, UserPlus, FileText, ShoppingCart, RotateCcw, User, Mail, Home, Mic, Pause, Play, PhoneCall, PhoneIncoming } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Device } from '@twilio/voice-sdk';
import { supabase } from '@/lib/customSupabaseClient';

const CallModal = ({ call, isOpen, onClose, onSaveLog, onAddNewCustomer, onStartSale, onViewInvoices, user }) => {
  const [status, setStatus] = useState('initializing'); // initializing, ready, ringing, connected, ended
  const [notes, setNotes] = useState('');
  const [timer, setTimer] = useState(0);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', address: '' });
  const [twilioDevice, setTwilioDevice] = useState(null);
  const [twilioCall, setTwilioCall] = useState(null);

  useEffect(() => {
    if (isOpen && user && !twilioDevice) {
      const setupTwilio = async () => {
        try {
          const { data } = await supabase.functions.invoke('twilio-capability-token', {
            body: { identity: user.id }
          });
          const device = new Device(data.token, {
            codecPreferences: ['opus', 'pcmu'],
            logLevel: 1,
          });
          
          device.on('ready', () => {
            setStatus('ready');
            setTwilioDevice(device);
          });

          device.on('incoming', (incomingCall) => {
            setStatus('ringing');
            setTwilioCall(incomingCall);
            incomingCall.on('accept', () => setStatus('connected'));
            incomingCall.on('disconnect', () => handleHangUp('answered'));
            incomingCall.on('cancel', () => handleHangUp('missed'));
          });

          device.on('error', (error) => {
            console.error('Twilio Device Error:', error);
            toast({ title: "PBX Error", description: error.message, variant: "destructive" });
            setStatus('error');
          });

        } catch (error) {
          console.error("Failed to get Twilio token", error);
          toast({ title: "PBX Error", description: "Could not connect to phone system.", variant: "destructive" });
          setStatus('error');
        }
      };
      setupTwilio();
    }

    return () => {
      if (twilioDevice) {
        twilioDevice.disconnectAll();
        twilioDevice.destroy();
        setTwilioDevice(null);
      }
    };
  }, [isOpen, user]);

  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(() => setTimer(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setTimer(0);
      setIsAddingCustomer(false);
      setNewCustomer({ name: '', email: '', address: '' });
      if (call?.direction === 'outbound' && twilioDevice) {
        makeCall();
      }
    }
  }, [isOpen, call, twilioDevice]);

  const makeCall = async () => {
    try {
      const outgoingCall = await twilioDevice.connect({ params: { To: call.phoneNumber } });
      setTwilioCall(outgoingCall);
      setStatus('ringing');
      outgoingCall.on('accept', () => setStatus('connected'));
      outgoingCall.on('disconnect', () => handleHangUp('answered'));
    } catch (error) {
      console.error("Error making call:", error);
      toast({ title: "Call Failed", description: error.message, variant: "destructive" });
      onClose();
    }
  };

  if (!isOpen || !call) return null;

  const handleAnswer = () => {
    if (twilioCall) {
      twilioCall.accept();
      setStatus('connected');
    }
  };
  
  const handleHangUp = (callStatus) => {
    if (twilioCall) {
      twilioCall.disconnect();
    }
    onSaveLog({
      customer_id: call.customer?.id || null,
      phone_number: call.phoneNumber,
      direction: call.direction,
      status: callStatus,
      duration_seconds: timer,
      notes: notes,
      twilio_call_sid: twilioCall?.parameters.CallSid,
    });
    onClose();
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const customer = await onAddNewCustomer({ ...newCustomer, phone: call.phoneNumber });
    if (customer) {
      call.customer = customer;
      setIsAddingCustomer(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const renderRinging = () => (
    <>
      <DialogHeader>
        <DialogTitle className="capitalize flex items-center gap-2">
          {call.direction === 'inbound' ? <PhoneIncoming/> : <PhoneCall/>}
          {call.direction} Call
        </DialogTitle>
        <DialogDescription>To/From: {call.phoneNumber}</DialogDescription>
      </DialogHeader>
      <div className="text-center py-8">
        <p className="text-lg font-semibold">{call.customer?.name || 'Unknown Caller'}</p>
        <p className="text-muted-foreground">{call.customer?.email}</p>
      </div>
      <DialogFooter>
        {call.direction === 'inbound' && (
          <>
            <Button variant="destructive" onClick={() => handleHangUp('declined')}>Decline</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleAnswer}>Answer</Button>
          </>
        )}
        {call.direction === 'outbound' && (
           <Button variant="destructive" onClick={() => handleHangUp('cancelled')}>Cancel Call</Button>
        )}
      </DialogFooter>
    </>
  );

  const renderConnected = () => (
    <>
      <DialogHeader>
        <DialogTitle>{call.customer?.name || call.phoneNumber}</DialogTitle>
        <DialogDescription>Call connected: {formatTime(timer)}</DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-4">
        {call.customer ? (
          <div>
            <h4 className="font-semibold mb-2">Contextual Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onStartSale(call.customer)}><ShoppingCart className="w-4 h-4 mr-2" /> New Sale</Button>
              <Button variant="outline" onClick={() => onViewInvoices(call.customer)}><FileText className="w-4 h-4 mr-2" /> View Invoices</Button>
              <Button variant="outline" disabled><RotateCcw className="w-4 h-4 mr-2" /> Start Return</Button>
            </div>
          </div>
        ) : (
          <div>
            {!isAddingCustomer ? (
              <Button onClick={() => setIsAddingCustomer(true)} className="w-full"><UserPlus className="w-4 h-4 mr-2" /> Add as New Customer</Button>
            ) : (
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-semibold">New Customer Details</h4>
                <div className="flex items-center space-x-2"><User className="text-muted-foreground" /><Input placeholder="Full Name*" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} autoFocus /></div>
                <div className="flex items-center space-x-2"><Mail className="text-muted-foreground" /><Input type="email" placeholder="Email Address" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} /></div>
                <div className="flex items-center space-x-2"><Home className="text-muted-foreground" /><Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} /></div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingCustomer(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddNewCustomer}>Save Customer</Button>
                </div>
              </div>
            )}
          </div>
        )}
        <div>
          <Label htmlFor="call-notes">Call Notes</Label>
          <Textarea id="call-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this call..." />
        </div>
      </div>
      <DialogFooter>
        <Button variant="destructive" onClick={() => handleHangUp(timer > 0 ? 'answered' : 'missed')}>
          <PhoneOff className="w-4 h-4 mr-2" /> Hang Up
        </Button>
      </DialogFooter>
    </>
  );

  const renderInitializing = () => (
    <div className="text-center py-12">
      <p className="text-lg font-semibold animate-pulse">Connecting to Phone System...</p>
    </div>
  );

  const renderContent = () => {
    switch (status) {
      case 'ringing':
        return renderRinging();
      case 'connected':
        return renderConnected();
      case 'initializing':
      case 'ready':
      case 'error':
        return renderInitializing();
      default:
        return renderRinging();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default CallModal;