import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Phone, Globe, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';

// SIP target string used for a registered desk phone. Tolerates the case where
// `sip_username` was stored as a full "user@host" (older device rows) so we
// don't end up with "sip:user@host@host".
const sipTargetForDevice = (d) => {
  const rawUser = String(d.sip_username || '').trim().replace(/^sip:/i, '');
  if (rawUser.includes('@')) return `sip:${rawUser}`;
  const domain = String(d.sip_domain || '').trim();
  return domain ? `sip:${rawUser}@${domain}` : `sip:${rawUser}`;
};

// Normalize PSTN numbers entered as 10/11-digit US to E.164. SignalWire requires
// E.164 (+1…) for outbound dialing — without the prefix the carrier just returns
// "wireless customer not available."
const normalizePstn = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
};

const ExtensionModal = ({ extension, teamMembers, devices, currentUserId, onSave, onClose }) => {
  const initial = extension || {};
  const [name, setName] = useState(initial.name || '');
  const [number, setNumber] = useState(initial.extension_number || '');
  const [email, setEmail] = useState(initial.email_for_voicemail || '');
  // Default new extensions to the current user so single-user accounts don't have to think about it.
  const [assignedUserId, setAssignedUserId] = useState(initial.assigned_user_id || currentUserId || '');
  const [ringTimeout, setRingTimeout] = useState(initial.ring_timeout_secs ?? 25);
  const [noAnswerAction, setNoAnswerAction] = useState(initial.no_answer_action || 'voicemail');
  const [forwardNumber, setForwardNumber] = useState(initial.forward_external_number || '');
  const [voicemailEnabled, setVoicemailEnabled] = useState(initial.voicemail_enabled ?? true);

  // Decompose existing ringers into the friendlier UI shape.
  const initialRingers = initial.ringers || [];
  const initialSipRingers = initialRingers.filter((r) => r.kind === 'sip');
  const initialBrowser = initialRingers.find((r) => r.kind === 'webrtc');
  const initialCell = initialRingers.find((r) => r.kind === 'pstn');

  // Map each selected device id → its existing ringer row (if any), so we keep ids stable on save.
  const [selectedDevices, setSelectedDevices] = useState(() => {
    const map = {};
    for (const d of devices || []) {
      const existing = initialSipRingers.find((r) => r.target === sipTargetForDevice(d));
      if (existing) map[d.id] = existing;
    }
    return map;
  });

  const [browserRing, setBrowserRing] = useState(!!initialBrowser);
  const [browserRingerId] = useState(initialBrowser?.id || null);

  const [cellEnabled, setCellEnabled] = useState(!!initialCell);
  const [cellNumber, setCellNumber] = useState(initialCell?.target || '');
  const [cellRingerId] = useState(initialCell?.id || null);

  const toggleDevice = (device) => {
    setSelectedDevices((prev) => {
      const next = { ...prev };
      if (next[device.id]) delete next[device.id];
      else next[device.id] = { kind: 'sip', target: sipTargetForDevice(device), label: device.label || `Ext ${device.sip_username}`, enabled: true };
      return next;
    });
  };

  const showAssignee = teamMembers.length > 1;

  const handleSave = () => {
    if (!name.trim() || !number) {
      toast({ title: 'Missing fields', description: 'Name and extension number are required.', variant: 'destructive' });
      return;
    }
    if (noAnswerAction === 'forward_external' && !forwardNumber.trim()) {
      toast({ title: 'Forward number required', description: 'Add a phone number to forward to.', variant: 'destructive' });
      return;
    }
    if (cellEnabled && !cellNumber.trim()) {
      toast({ title: 'Cell number required', description: 'Add a number, or turn off the cell-phone ringer.', variant: 'destructive' });
      return;
    }
    if (browserRing && !assignedUserId) {
      toast({ title: 'Assign someone first', description: 'Browser pop-up needs an assigned user to know whose screen to ring.', variant: 'destructive' });
      return;
    }

    const ringers = [];
    let priority = 0;

    // Selected SIP devices
    for (const d of devices || []) {
      const existing = selectedDevices[d.id];
      if (!existing) continue;
      ringers.push({
        ...existing,
        kind: 'sip',
        target: sipTargetForDevice(d),
        label: d.label || `Ext ${d.sip_username}`,
        enabled: true,
        priority: priority++,
      });
    }

    if (browserRing) {
      ringers.push({
        id: browserRingerId || undefined,
        kind: 'webrtc',
        target: `webrtc:${assignedUserId}`,
        label: 'Browser pop-up',
        enabled: true,
        priority: priority++,
      });
    }

    if (cellEnabled) {
      ringers.push({
        id: cellRingerId || undefined,
        kind: 'pstn',
        target: normalizePstn(cellNumber),
        label: 'Cell phone',
        enabled: true,
        priority: priority++,
      });
    }

    onSave({
      base: {
        ...extension,
        name: name.trim(),
        extension_number: parseInt(number, 10),
        email_for_voicemail: email.trim() || null,
        assigned_user_id: assignedUserId || null,
        ring_timeout_secs: Number(ringTimeout) || 25,
        no_answer_action: noAnswerAction,
        forward_external_number: noAnswerAction === 'forward_external' ? normalizePstn(forwardNumber) : null,
        voicemail_enabled: !!voicemailEnabled,
      },
      ringers,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
      <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
        <DialogTitle>{extension?.id ? 'Edit Extension' : 'Add Extension'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5 py-3 px-6 overflow-y-auto flex-1 min-h-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ext-name">Name</Label>
            <Input id="ext-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ext-number">Extension number</Label>
            <Input id="ext-number" type="number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="101" />
          </div>
        </div>

        {/* Assigned user — only shown when there are multiple team members */}
        {showAssignee && (
          <div className="space-y-1.5">
            <Label>Who handles this line?</Label>
            <Select value={assignedUserId || '__none'} onValueChange={(v) => setAssignedUserId(v === '__none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Pick a team member…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Their browser will get the screen pop-up when this line rings.</p>
          </div>
        )}

        {/* Ring devices */}
        <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
          <div>
            <Label>Ring these phones</Label>
            <p className="text-[11px] text-muted-foreground">All checked phones ring at the same time. Whoever picks up first takes the call.</p>
          </div>

          {(!devices || devices.length === 0) ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground bg-background">
              <p className="font-medium text-foreground mb-1">No phones registered yet.</p>
              <p>Go to <strong>Phones</strong> in the sidebar to add a desk phone (Yealink, etc.) by MAC address. Once it's registered with SignalWire, it will show up here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {devices.map((d) => {
                const checked = !!selectedDevices[d.id];
                return (
                  <label key={d.id} className="flex items-center gap-3 rounded-md border bg-background p-2.5 cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" checked={checked} onChange={() => toggleDevice(d)} className="h-4 w-4" />
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.label || `Ext ${d.sip_username}`}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {d.model ? `${d.model} · ` : ''}{d.sip_username}@{d.sip_domain}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Browser pop-up */}
          <div className="flex items-center justify-between rounded-md border bg-background p-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">Also ring my browser (screen pop-up)</div>
                <div className="text-[11px] text-muted-foreground">A notification appears in the POS for the assigned user. They can answer right in the browser.</div>
              </div>
            </div>
            <Switch checked={browserRing} onCheckedChange={setBrowserRing} />
          </div>

          {/* Cell phone fallback */}
          <div className="rounded-md border bg-background p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">Also ring a cell phone</div>
                  <div className="text-[11px] text-muted-foreground">Your real mobile number — handy when you're out of the store.</div>
                </div>
              </div>
              <Switch checked={cellEnabled} onCheckedChange={setCellEnabled} />
            </div>
            {cellEnabled && (
              <>
                <Input
                  value={cellNumber}
                  placeholder="(555) 123-4567"
                  onChange={(e) => setCellNumber(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">US numbers are auto-formatted to +1…. Tip: don't point this at the same phone you're using to call in — the line will be busy.</p>
              </>
            )}
          </div>
        </div>

        {/* No-answer */}
        <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
          <Label>If nobody answers</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">After (seconds)</Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={ringTimeout}
                onChange={(e) => setRingTimeout(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Then</Label>
              <Select value={noAnswerAction} onValueChange={setNoAnswerAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voicemail">Send to voicemail</SelectItem>
                  <SelectItem value="forward_external">Forward to another number</SelectItem>
                  <SelectItem value="hangup">Hang up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {noAnswerAction === 'forward_external' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Forward to</Label>
              <Input
                value={forwardNumber}
                placeholder="+18455551234"
                onChange={(e) => setForwardNumber(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Voicemail */}
        <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Voicemail</Label>
              <p className="text-[11px] text-muted-foreground">Allow callers to leave a message when no one answers.</p>
            </div>
            <Switch checked={!!voicemailEnabled} onCheckedChange={setVoicemailEnabled} />
          </div>
          {voicemailEnabled && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Email voicemails to</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const ExtensionsManager = ({ extensions, handlers }) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [devices, setDevices] = useState([]);

  // Pull user profiles + registered phones.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: profiles }, { data: devs }] = await Promise.all([
          supabase.from('user_profiles').select('user_id, full_name, email, approval_status'),
          supabase.from('pbx_devices').select('id, label, model, sip_username, sip_domain').order('created_at', { ascending: true }),
        ]);
        if (cancelled) return;
        const list = (profiles || []).filter((p) => !p.approval_status || p.approval_status === 'approved');
        if (user?.id && !list.some((p) => p.user_id === user.id)) {
          list.unshift({ user_id: user.id, full_name: 'Me', email: user.email });
        }
        setTeamMembers(list);
        setDevices(devs || []);
      } catch {
        if (!cancelled && user?.id) {
          setTeamMembers([{ user_id: user.id, full_name: 'Me', email: user.email }]);
          setDevices([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  const userLabelById = useMemo(() => {
    const m = new Map();
    for (const u of teamMembers) m.set(u.user_id, u.full_name || u.email || u.user_id.slice(0, 8));
    return m;
  }, [teamMembers]);

  const persistRingers = async (extensionId, originalRingers, nextRingers) => {
    const ringerHandlers = handlers?.ringers;
    if (!ringerHandlers) return;
    const originalById = new Map((originalRingers || []).map((r) => [r.id, r]));
    const nextIds = new Set(nextRingers.filter((r) => r.id).map((r) => r.id));
    for (const r of originalRingers || []) {
      if (!nextIds.has(r.id)) await ringerHandlers.delete(r.id);
    }
    for (const r of nextRingers) {
      const payload = {
        kind: r.kind,
        target: r.target,
        label: r.label || null,
        priority: r.priority || 0,
        enabled: !!r.enabled,
      };
      if (!r.id) {
        await ringerHandlers.add(extensionId, payload);
      } else {
        const orig = originalById.get(r.id);
        const changed = !orig
          || orig.kind !== payload.kind
          || orig.target !== payload.target
          || (orig.label || null) !== (payload.label || null)
          || (orig.priority || 0) !== payload.priority
          || !!orig.enabled !== payload.enabled;
        if (changed) await ringerHandlers.update({ id: r.id, ...payload });
      }
    }
  };

  const handleSave = async ({ base, ringers }) => {
    try {
      let row = base;
      if (base.id) {
        await handlers.update(base);
        row = base;
      } else {
        const inserted = await handlers.add(base);
        row = inserted || base;
      }
      const extensionId = row?.id || base.id;
      if (extensionId) {
        const original = (extensions.find((e) => e.id === extensionId) || {}).ringers || [];
        await persistRingers(extensionId, original, ringers);
      }
      toast({ title: 'Saved', description: `Extension ${base.extension_number} saved.` });
      setIsModalOpen(false);
      setSelectedExtension(null);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this extension? Its ringers will be removed too.')) return;
    try {
      await handlers.delete(id);
      toast({ title: 'Extension deleted' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const summarizeRings = (ext) => {
    const enabled = (ext.ringers || []).filter((r) => r.enabled);
    if (enabled.length === 0) return { text: 'No ringers — straight to voicemail', warn: true };
    const parts = [];
    const sipCount = enabled.filter((r) => r.kind === 'sip').length;
    if (sipCount) parts.push(`${sipCount} desk phone${sipCount > 1 ? 's' : ''}`);
    if (enabled.some((r) => r.kind === 'webrtc')) parts.push('browser');
    if (enabled.some((r) => r.kind === 'pstn')) parts.push('cell');
    return { text: parts.join(' + '), warn: false };
  };

  const showAssignedColumn = teamMembers.length > 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Extensions</CardTitle>
          <CardDescription>Set how each extension rings and what happens if no one answers.</CardDescription>
        </div>
        <Button onClick={() => { setSelectedExtension({}); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Extension
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 font-semibold border-b bg-muted/50 p-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="col-span-2">Ext</span>
            <span className="col-span-3">Name</span>
            {showAssignedColumn && <span className="col-span-3">Handled by</span>}
            <span className={showAssignedColumn ? 'col-span-3' : 'col-span-6'}>Rings</span>
            <span className="col-span-1 text-right">Actions</span>
          </div>
          {extensions.map((ext) => {
            const ring = summarizeRings(ext);
            return (
              <div key={ext.id} className="grid grid-cols-12 items-center p-3 border-b last:border-b-0 gap-2">
                <span className="col-span-2 font-mono">{ext.extension_number}</span>
                <span className="col-span-3 font-medium truncate">{ext.name}</span>
                {showAssignedColumn && (
                  <span className="col-span-3 text-sm truncate">
                    {ext.assigned_user_id ? (userLabelById.get(ext.assigned_user_id) || 'Assigned') : <span className="text-muted-foreground">Unassigned</span>}
                  </span>
                )}
                <span className={`${showAssignedColumn ? 'col-span-3' : 'col-span-6'} text-xs ${ring.warn ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {ring.text}
                </span>
                <div className="col-span-1 flex gap-1 justify-end">
                  <Button variant="outline" size="icon" onClick={() => { setSelectedExtension(ext); setIsModalOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(ext.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {extensions.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No extensions created yet.</p>
          )}
        </div>
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        {isModalOpen && (
          <ExtensionModal
            extension={selectedExtension}
            teamMembers={teamMembers}
            devices={devices}
            currentUserId={user?.id}
            onSave={handleSave}
            onClose={() => { setIsModalOpen(false); setSelectedExtension(null); }}
          />
        )}
      </Dialog>
    </Card>
  );
};

export default ExtensionsManager;
