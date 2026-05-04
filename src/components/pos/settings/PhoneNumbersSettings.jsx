import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import {
  Phone,
  PhoneForwarded,
  PhoneIncoming,
  Voicemail,
  ListTree,
  Clock,
  MessageSquare,
  PlayCircle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Pencil,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

// ─── Helpers ────────────────────────────────────────────────────────────────
const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');
const canonicalStorePhone = (v) => {
  const d = digitsOnly(v);
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length === 10) return d;
  return d;
};
const formatDisplayPhone = (v) => {
  const d = canonicalStorePhone(v);
  if (!d) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)})-${d.slice(3)}`;
  return `(${d.slice(0, 3)})-${d.slice(3, 6)}-${d.slice(6, 10)}`;
};

const ROUTING_TYPES = [
  { id: 'flow', label: 'Run automated ordering flow', icon: PhoneIncoming, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'business_hours', label: 'Route by time of day (open / closed)', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'ivr_menu', label: 'Transfer to IVR / Auto attendant', icon: ListTree, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'forward', label: 'Forward to a phone number', icon: PhoneForwarded, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'play', label: 'Play a message and hang up', icon: PlayCircle, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'voicemail', label: 'Send to voicemail', icon: Voicemail, color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const defaultNodeForType = (type) => {
  switch (type) {
    case 'flow': return { type: 'flow', flowId: null };
    case 'forward': return { type: 'forward', number: '', callerIdPassthrough: false };
    case 'play': return { type: 'play', message: 'Hello, thank you for calling. Please call back later.' };
    case 'voicemail': return { type: 'voicemail', greeting: 'Please leave a message after the beep.', notifySms: '', notifyEmail: '' };
    case 'business_hours': return {
      type: 'business_hours',
      open: { type: 'flow', flowId: null },
      closed: { type: 'play', message: "Sorry, we're currently closed. Please call back during business hours." },
    };
    case 'ivr_menu': return { type: 'ivr_menu', menuId: null };
    default: return { type: 'flow', flowId: null };
  }
};

const summarizeNode = (node) => {
  if (!node || typeof node !== 'object') return 'Not configured';
  switch (node.type) {
    case 'flow': return node.flowId ? 'Run a specific flow' : 'Run primary flow';
    case 'forward': return `Forward → ${formatDisplayPhone(node.number) || node.number || '(no number)'}`;
    case 'play': return `Play: "${(node.message || '').slice(0, 40)}${(node.message || '').length > 40 ? '…' : ''}"`;
    case 'voicemail': return 'Voicemail';
    case 'business_hours': return 'Route by time of day';
    case 'ivr_menu': return node.menuId ? 'Transfer to IVR' : 'IVR (not selected)';
    default: return 'Unknown';
  }
};

// ─── Recursive routing node editor ──────────────────────────────────────────
const RoutingNode = ({ value, onChange, flows, ivrMenus, depth = 0 }) => {
  const node = value || { type: 'flow', flowId: null };
  const meta = ROUTING_TYPES.find((t) => t.id === node.type) || ROUTING_TYPES[0];
  const Icon = meta.icon;

  const setType = (type) => onChange(defaultNodeForType(type));

  return (
    <div className={`rounded-xl border ${depth === 0 ? 'border-2' : ''} bg-card p-4 space-y-3`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.color}`}>
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
        <Select value={node.type} onValueChange={setType}>
          <SelectTrigger className="h-8 text-xs w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROUTING_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {node.type === 'flow' && (
        <div>
          <Label className="text-xs text-muted-foreground">Which flow?</Label>
          <Select value={node.flowId || '__primary__'} onValueChange={(v) => onChange({ ...node, flowId: v === '__primary__' ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__primary__">⭐ Primary flow (default)</SelectItem>
              {(flows || []).filter((f) => !f.is_primary).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}{!f.published ? ' (draft)' : ''}{!f.is_active ? ' (off)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {node.type === 'forward' && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Phone number to forward to</Label>
            <Input
              placeholder="(845)-555-1234"
              value={formatDisplayPhone(node.number) || node.number || ''}
              onChange={(e) => onChange({ ...node, number: canonicalStorePhone(e.target.value) })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!node.callerIdPassthrough} onCheckedChange={(v) => onChange({ ...node, callerIdPassthrough: v })} />
            <span className="text-xs text-muted-foreground">Show original caller's number to the receiver</span>
          </div>
        </div>
      )}

      {node.type === 'play' && (
        <div>
          <Label className="text-xs text-muted-foreground">What should the caller hear?</Label>
          <Textarea
            rows={3}
            value={node.message || ''}
            onChange={(e) => onChange({ ...node, message: e.target.value })}
          />
        </div>
      )}

      {node.type === 'voicemail' && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Greeting</Label>
            <Textarea
              rows={2}
              value={node.greeting || ''}
              onChange={(e) => onChange({ ...node, greeting: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Notify by SMS (optional)</Label>
              <Input placeholder="(845)-555-1234" value={node.notifySms || ''} onChange={(e) => onChange({ ...node, notifySms: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notify by email (optional)</Label>
              <Input placeholder="you@store.com" value={node.notifyEmail || ''} onChange={(e) => onChange({ ...node, notifyEmail: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {node.type === 'business_hours' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Uses your store hours from <span className="font-medium">PBX → Business Hours</span>. Calls are routed below based on whether the store is currently open.</p>
          <div className="rounded-lg border p-3 bg-emerald-50/30 space-y-2">
            <div className="text-xs font-medium text-emerald-700">When OPEN →</div>
            <RoutingNode value={node.open} onChange={(child) => onChange({ ...node, open: child })} flows={flows} ivrMenus={ivrMenus} depth={depth + 1} />
          </div>
          <div className="rounded-lg border p-3 bg-rose-50/30 space-y-2">
            <div className="text-xs font-medium text-rose-700">When CLOSED →</div>
            <RoutingNode value={node.closed} onChange={(child) => onChange({ ...node, closed: child })} flows={flows} ivrMenus={ivrMenus} depth={depth + 1} />
          </div>
        </div>
      )}

      {node.type === 'ivr_menu' && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Which IVR / auto attendant?</Label>
          <Select value={node.menuId || ''} onValueChange={(v) => onChange({ ...node, menuId: v || null })}>
            <SelectTrigger>
              <SelectValue placeholder={(ivrMenus || []).length ? 'Select an IVR menu…' : 'No IVR menus yet — create one first'} />
            </SelectTrigger>
            <SelectContent>
              {(ivrMenus || []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name || 'Untitled menu'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Build and edit IVRs in <span className="font-medium">PBX → IVR / Auto attendant</span>. They&apos;ll show up here automatically.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Main page ──────────────────────────────────────────────────────────────
const PhoneNumbersSettings = ({ hideAdminMode = false } = {}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [flows, setFlows] = useState([]);
  const [ivrMenus, setIvrMenus] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingRouting, setEditingRouting] = useState(null);
  const [savingRouting, setSavingRouting] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [users, setUsers] = useState([]);
  const [adminTargetUserId, setAdminTargetUserId] = useState('');
  const [adminTargetChannels, setAdminTargetChannels] = useState([]);
  const [assignPhone, setAssignPhone] = useState('');
  const [assignLabel, setAssignLabel] = useState('');
  const [assignProvider, setAssignProvider] = useState('');
  const [assignSecret, setAssignSecret] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);

  const selected = useMemo(() => channels.find((c) => c.id === selectedId) || null, [channels, selectedId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: nums }, { data: fl }, ivrRes] = await Promise.all([
        supabase.functions.invoke('voice-config', { body: { action: 'list_my_phone_numbers' } }),
        supabase.functions.invoke('voice-config', { body: { action: 'list_flows' } }),
        supabase.from('pbx_ivr_menus').select('id, name').eq('user_id', user?.id).order('name'),
      ]);
      const list = nums?.channels || [];
      setChannels(list);
      setFlows(fl?.flows || []);
      setIvrMenus(ivrRes?.data || []);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to load phone numbers', description: e.message });
    }
    setLoading(false);
  }, [selectedId, user?.id]);

  const loadAdminContext = useCallback(async () => {
    const { data } = await supabase.functions.invoke('voice-admin', { body: { action: 'get_admin_context' } });
    if (data?.isAdmin) {
      setAdminMode(true);
      setUsers(data.users || []);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadAll();
    if (!hideAdminMode) loadAdminContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    setEditingRouting(selected?.routing ? JSON.parse(JSON.stringify(selected.routing)) : defaultNodeForType('flow'));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRouting = async () => {
    if (!selected) return;
    setSavingRouting(true);
    const { data, error } = await supabase.functions.invoke('voice-config', {
      body: { action: 'update_phone_routing', channelId: selected.id, routing: editingRouting },
    });
    setSavingRouting(false);
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Save failed', description: data?.error || error?.message });
      return;
    }
    toast({ title: 'Routing saved' });
    await loadAll();
  };

  const renameLabel = async () => {
    if (!selected) return;
    const next = window.prompt('New label for this number:', selected.label || '');
    if (!next || !next.trim()) return;
    const { data, error } = await supabase.functions.invoke('voice-config', {
      body: { action: 'update_phone_label', channelId: selected.id, label: next.trim() },
    });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Rename failed', description: data?.error || error?.message });
      return;
    }
    await loadAll();
  };

  const togglePhoneActive = async (channel) => {
    const { data, error } = await supabase.functions.invoke('voice-config', {
      body: { action: 'set_phone_active', channelId: channel.id, isActive: !channel.is_active },
    });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Toggle failed', description: data?.error || error?.message });
      return;
    }
    await loadAll();
  };

  const loadAdminTargetChannels = async (uid) => {
    setAdminTargetUserId(uid);
    if (!uid) { setAdminTargetChannels([]); return; }
    const { data } = await supabase.functions.invoke('voice-admin', {
      body: { action: 'list_user_phone_numbers', targetUserId: uid },
    });
    setAdminTargetChannels(data?.channels || []);
  };

  const adminAssign = async () => {
    if (!adminTargetUserId || !assignPhone) {
      toast({ variant: 'destructive', title: 'User and phone number are required' });
      return;
    }
    setAdminBusy(true);
    const { data, error } = await supabase.functions.invoke('voice-admin', {
      body: {
        action: 'assign_phone_number',
        targetUserId: adminTargetUserId,
        phoneNumberE164: canonicalStorePhone(assignPhone),
        providerAccountId: assignProvider || undefined,
        webhookSecret: assignSecret || undefined,
        label: assignLabel || undefined,
      },
    });
    setAdminBusy(false);
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Assign failed', description: data?.error || error?.message });
      return;
    }
    toast({ title: 'Number assigned' });
    setAssignPhone(''); setAssignLabel(''); setAssignProvider(''); setAssignSecret('');
    await loadAdminTargetChannels(adminTargetUserId);
    if (adminTargetUserId === user?.id) await loadAll();
  };

  const adminUnassign = async (channelId) => {
    if (!window.confirm('Remove this number from this user?')) return;
    const { data, error } = await supabase.functions.invoke('voice-admin', {
      body: { action: 'unassign_phone_number', targetUserId: adminTargetUserId, channelId },
    });
    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Remove failed', description: data?.error || error?.message });
      return;
    }
    await loadAdminTargetChannels(adminTargetUserId);
    if (adminTargetUserId === user?.id) await loadAll();
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading phone numbers…</div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><Phone className="w-5 h-5" /> Phone Numbers</h1>
          <p className="text-sm text-muted-foreground">Set what happens when each of your phone numbers receives a call.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>You don't have any phone numbers yet. An admin needs to assign one to your account.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your numbers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {channels.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${isSel ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{c.label || 'Unnamed line'}</div>
                      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.is_active ? 'On' : 'Off'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDisplayPhone(c.inbound_phone_e164)}</div>
                    <div className="flex items-center gap-1 mt-1.5 text-[11px]">
                      {c.configured ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> {summarizeNode(c.routing)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700"><AlertCircle className="w-3 h-3" /> Needs setup</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selected ? (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {selected.label || 'Unnamed line'}
                        <Button variant="ghost" size="sm" onClick={renameLabel}><Pencil className="w-3.5 h-3.5" /></Button>
                      </CardTitle>
                      <CardDescription>{formatDisplayPhone(selected.inbound_phone_e164)}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={selected.is_active} onCheckedChange={() => togglePhoneActive(selected)} />
                      <span className="text-xs text-muted-foreground">{selected.is_active ? 'Accepting calls' : 'Off — calls fail'}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                    <div className="font-medium mb-1">When a call comes in to this number:</div>
                    <div className="text-muted-foreground">Build the steps below. The first matching action runs.</div>
                  </div>
                  {editingRouting && (
                    <RoutingNode value={editingRouting} onChange={setEditingRouting} flows={flows} ivrMenus={ivrMenus} depth={0} />
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditingRouting(selected.routing ? JSON.parse(JSON.stringify(selected.routing)) : defaultNodeForType('flow'))}
                    >
                      Cancel
                    </Button>
                    <Button onClick={saveRouting} disabled={savingRouting}>
                      <Save className="w-4 h-4 mr-1" />
                      {savingRouting ? 'Saving…' : 'Save routing'}
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="p-8 text-center text-sm text-muted-foreground">Select a number to edit its routing.</CardContent>
            )}
          </Card>
        </div>
      )}

      {adminMode && (
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-xs font-medium uppercase bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admin</span>
              Assign a phone number to a user
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Target user</Label>
              <Select value={adminTargetUserId} onValueChange={loadAdminTargetChannels}>
                <SelectTrigger><SelectValue placeholder="Pick a user…" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.email || u.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {adminTargetUserId && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-medium">Current numbers for this user:</div>
                {adminTargetChannels.length === 0 ? (
                  <div className="text-xs text-muted-foreground">None.</div>
                ) : adminTargetChannels.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{c.label || 'Unnamed'}</span>
                      <span className="text-muted-foreground ml-2">{formatDisplayPhone(c.inbound_phone_e164)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => adminUnassign(c.id)}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone number</Label>
                <Input placeholder="(845)-555-1234" value={assignPhone} onChange={(e) => setAssignPhone(formatDisplayPhone(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Label</Label>
                <Input placeholder="Main line / Catering line" value={assignLabel} onChange={(e) => setAssignLabel(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Provider account ID (optional)</Label>
                <Input value={assignProvider} onChange={(e) => setAssignProvider(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Webhook secret (optional)</Label>
                <Input type="password" value={assignSecret} onChange={(e) => setAssignSecret(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={adminAssign} disabled={adminBusy || !adminTargetUserId || !assignPhone}>
                <Plus className="w-4 h-4 mr-1" /> Assign number
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PhoneNumbersSettings;
