import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Copy, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const PROVISION_BASE = 'https://tjjueyedvxhkvinxsszy.supabase.co/functions/v1/provision';
const DEFAULT_SIP_DOMAIN = '4gonwheels-d3049efc26a8.sip.signalwire.com';

const YEALINK_MODELS = [
  { group: 'T5x Series (recommended)', items: ['T54W', 'T53W', 'T53', 'T57W', 'T58W'] },
  { group: 'T4x Series', items: ['T46S', 'T46U', 'T46G', 'T48S', 'T48U', 'T42S', 'T42U', 'T41S', 'T41P', 'T40G', 'T40P'] },
  { group: 'T3x Series', items: ['T33G', 'T33P', 'T31P', 'T31G', 'T30P'] },
  { group: 'Cordless', items: ['W73P', 'W76P', 'W56H'] },
  { group: 'Conference', items: ['CP925', 'CP935W', 'CP965'] },
  { group: 'Other', items: ['Other Yealink', 'Other vendor'] },
];

const normalizeMac = (raw) => raw.toLowerCase().replace(/[^a-f0-9]/g, '');

const formatMac = (raw) =>
  normalizeMac(raw).match(/.{2}/g)?.join(':').toUpperCase() || raw;

const isRecentlySeen = (ts) => {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 24 * 60 * 60 * 1000; // within 24h
};

const DeviceModal = ({ device, extensions, onSave, onClose }) => {
  const [mac, setMac] = useState(device?.mac ? formatMac(device.mac) : '');
  const [label, setLabel] = useState(device?.label || '');
  const [model, setModel] = useState(device?.model || '');
  const [sipUsername, setSipUsername] = useState(device?.sip_username || '');
  const [sipDomain, setSipDomain] = useState(device?.sip_domain || DEFAULT_SIP_DOMAIN);
  const [sipPassword, setSipPassword] = useState(device?.sip_password || '');
  const [extensionId, setExtensionId] = useState(device?.extension_id || '');
  const [accountSlot, setAccountSlot] = useState(device?.account_slot ?? 1);
  const isEdit = !!device?.id;

  const handleSave = () => {
    const cleanMac = normalizeMac(mac);
    if (cleanMac.length !== 12) {
      toast({ title: 'Invalid MAC', description: 'MAC address must be 12 hex characters.', variant: 'destructive' });
      return;
    }
    if (!sipUsername || !sipDomain || !sipPassword) {
      toast({ title: 'Missing fields', description: 'SIP username, domain and password are required.', variant: 'destructive' });
      return;
    }
    onSave({
      ...device,
      mac: cleanMac,
      label: label.trim() || `Ext ${sipUsername}`,
      model: model.trim() || null,
      sip_username: sipUsername.trim(),
      sip_domain: sipDomain.trim(),
      sip_password: sipPassword,
      extension_id: extensionId || null,
      account_slot: Number(accountSlot) || 1,
    });
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Phone' : 'Add Phone'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>MAC Address *</Label>
            <Input value={mac} onChange={e => setMac(e.target.value)} placeholder="80:5E:C0:5B:12:34" disabled={isEdit} />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Select model…</option>
              {YEALINK_MODELS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Label</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Front desk" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>SIP Username *</Label>
            <Input value={sipUsername} onChange={e => setSipUsername(e.target.value)} placeholder="101" />
          </div>
          <div className="space-y-1">
            <Label>Extension</Label>
            <select
              value={extensionId}
              onChange={e => setExtensionId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">— none —</option>
              {(extensions || []).map(ext => (
                <option key={ext.id} value={ext.id}>{ext.name} ({ext.extension_number})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>SIP Domain *</Label>
          <Input value={sipDomain} onChange={e => setSipDomain(e.target.value)} placeholder="yourspace.sip.signalwire.com" />
          <p className="text-xs text-muted-foreground">Same for all your phones — leave the default.</p>
        </div>
        <div className="space-y-1">
          <Label>Account slot on phone</Label>
          <select
            value={accountSlot}
            onChange={e => setAccountSlot(parseInt(e.target.value, 10))}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          >
            {Array.from({ length: 16 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Account {n}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Which line slot on the phone (1–16). Use a free slot to avoid overwriting an existing provider.</p>
        </div>
        <div className="space-y-1">
          <Label>SIP Password *</Label>
          <Input type="password" value={sipPassword} onChange={e => setSipPassword(e.target.value)} placeholder="Strong password from SignalWire" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>{isEdit ? 'Save' : 'Add Phone'}</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const DevicesManager = ({ extensions }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pbx_devices')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setDevices(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (device) => {
    try {
      if (device.id) {
        const { error } = await supabase
          .from('pbx_devices')
          .update({
            label: device.label,
            model: device.model,
            sip_username: device.sip_username,
            sip_domain: device.sip_domain,
            sip_password: device.sip_password,
            extension_id: device.extension_id,
            account_slot: device.account_slot,
            config_version: (device.config_version || 1) + 1, // bump so phone re-fetches
          })
          .eq('id', device.id);
        if (error) throw error;
        toast({ title: 'Phone updated', description: 'Config version bumped — phone will re-provision on next check.' });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');
        const { error } = await supabase
          .from('pbx_devices')
          .insert({
            user_id: user.id,
            mac: device.mac,
            label: device.label,
            model: device.model,
            sip_username: device.sip_username,
            sip_domain: device.sip_domain,
            sip_password: device.sip_password,
            extension_id: device.extension_id,
            account_slot: device.account_slot,
          });
        if (error) throw error;
        toast({ title: 'Phone added' });
      }
      setModalOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this phone?')) return;
    const { error } = await supabase.from('pbx_devices').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Phone removed' });
    await load();
  };

  const copyUrl = (token) => {
    const url = `${PROVISION_BASE}/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied!', description: "Paste this URL into the phone's Auto Provision → Server URL field." });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Phones</CardTitle>
          <CardDescription>
            Add a phone by MAC address. Copy the provisioning URL and paste it into the phone's
            <strong> Auto Provision → Server URL</strong> field — it will register itself automatically.
          </CardDescription>
        </div>
        <Button onClick={() => { setSelected({}); setModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Phone
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : devices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Smartphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No phones added yet.</p>
            <p className="text-xs mt-1">Click <strong>Add Phone</strong> and enter the MAC address from the sticker on the bottom of your Yealink.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map(d => {
              const online = isRecentlySeen(d.last_seen_at);
              const ext = (extensions || []).find(e => e.id === d.extension_id);
              return (
                <div key={d.id} className="border rounded-lg p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {d.label || `Ext ${d.sip_username}`}
                          {d.model && <span className="text-xs text-muted-foreground">({d.model})</span>}
                          {online
                            ? <Badge variant="outline" className="text-green-600 border-green-400 gap-1"><Wifi className="w-3 h-3" />Active</Badge>
                            : <Badge variant="outline" className="text-muted-foreground gap-1"><WifiOff className="w-3 h-3" />{d.last_seen_at ? 'Offline' : 'Not yet provisioned'}</Badge>
                          }
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          MAC: {formatMac(d.mac)} · SIP: {d.sip_username}@{d.sip_domain}
                          {ext && <> · Ext: {ext.name} ({ext.extension_number})</>}
                        </div>
                        {d.last_seen_at && (
                          <div className="text-xs text-muted-foreground">Last seen: {new Date(d.last_seen_at).toLocaleString()}{d.last_seen_ip ? ` from ${d.last_seen_ip}` : ''}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="icon" onClick={() => { setSelected(d); setModalOpen(true); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Provisioning URL */}
                  <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                    <code className="text-xs flex-1 truncate">{PROVISION_BASE}/{d.provision_token}</code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyUrl(d.provision_token)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Paste the URL above into <strong>Yealink web UI → Settings → Auto Provision → Server URL</strong>, then click Autoprovision Now.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        {modalOpen && (
          <DeviceModal
            device={selected}
            extensions={extensions}
            onSave={handleSave}
            onClose={() => { setModalOpen(false); setSelected(null); }}
          />
        )}
      </Dialog>
    </Card>
  );
};

export default DevicesManager;
