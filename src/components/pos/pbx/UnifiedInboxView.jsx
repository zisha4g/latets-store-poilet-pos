import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Inbox, MessageSquare, Mail, Search, Send, X, RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useEmailAccount } from '@/hooks/useEmailAccount';
import { EmailThread } from '@/components/pos/pbx/EmailView';

const formatTime = (iso) => {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
};

const formatPhone = (raw) => {
  if (!raw) return '—';
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
};

const smsKey = (m) => m.thread_key || (m.direction === 'inbound' ? m.from_number : m.to_number);

/** Inline SMS thread reused inside the unified drawer. */
const SmsThreadInline = ({ threadKey, messages, onSend }) => {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const ordered = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [messages],
  );
  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await onSend(threadKey, body.trim());
      setBody('');
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <div className="font-mono font-medium">{formatPhone(threadKey)}</div>
        <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">SMS</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {ordered.map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
              m.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-background border'
            }`}>
              {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
              <div className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {formatTime(m.created_at)}{m.status && m.direction === 'outbound' ? ` · ${m.status}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t flex gap-2 items-end">
        <Textarea
          rows={2}
          placeholder="Reply by text…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="resize-none"
        />
        <Button onClick={send} disabled={sending || !body.trim()}>
          <Send className="w-4 h-4 mr-1" />{sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </div>
  );
};

const UnifiedInboxView = () => {
  const { user } = useAuth();
  const { account: emailAccount } = useEmailAccount();
  const [sms, setSms] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(null); // { type, key }
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [smsRes, emailRes] = await Promise.all([
      supabase.from('pbx_sms_messages').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('pbx_email_messages').select('*').order('internal_date', { ascending: false }).limit(300),
    ]);
    if (!smsRes.error) setSms(smsRes.data || []);
    if (!emailRes.error) setEmails(emailRes.data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime: subscribe to both tables.
  useEffect(() => {
    if (!user?.id) return undefined;
    const sCh = supabase.channel(`unified-sms-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_sms_messages', filter: `user_id=eq.${user.id}` }, () => reload())
      .subscribe();
    const eCh = supabase.channel(`unified-email-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_email_messages', filter: `user_id=eq.${user.id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(sCh); supabase.removeChannel(eCh); };
  }, [user?.id, reload]);

  // Flat chronological feed (one row per thread, latest first).
  const items = useMemo(() => {
    const smsGroups = new Map();
    for (const m of sms) {
      const k = smsKey(m);
      if (!k) continue;
      const g = smsGroups.get(k) || { messages: [], unread: 0 };
      g.messages.push(m);
      if (m.direction === 'inbound' && !m.is_read) g.unread += 1;
      smsGroups.set(k, g);
    }
    const smsItems = Array.from(smsGroups.entries()).map(([key, g]) => {
      const last = g.messages.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b));
      return {
        type: 'sms', key, last, unread: g.unread,
        ts: new Date(last.created_at).getTime(),
        title: formatPhone(key),
        preview: (last.direction === 'outbound' ? 'You: ' : '') + (last.body || (last.num_media ? `[${last.num_media} media]` : '')),
      };
    });

    const emailGroups = new Map();
    for (const m of emails) {
      const k = m.gmail_thread_id;
      if (!k) continue;
      const g = emailGroups.get(k) || { messages: [], unread: 0 };
      g.messages.push(m);
      if (m.direction === 'inbound' && !m.is_read) g.unread += 1;
      emailGroups.set(k, g);
    }
    const emailItems = Array.from(emailGroups.entries()).map(([key, g]) => {
      const last = g.messages.reduce((a, b) => (new Date(a.internal_date) > new Date(b.internal_date) ? a : b));
      return {
        type: 'email', key, last, unread: g.unread,
        ts: new Date(last.internal_date).getTime(),
        title: last.direction === 'outbound' ? ((last.to_addrs || [])[0] || '') : (last.from_name || last.from_addr || ''),
        subject: last.subject || '(no subject)',
        preview: last.snippet || '',
      };
    });

    return [...smsItems, ...emailItems].sort((a, b) => b.ts - a.ts);
  }, [sms, emails]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      (it.title || '').toLowerCase().includes(q) ||
      (it.subject || '').toLowerCase().includes(q) ||
      (it.preview || '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const handleSendSms = async (to, body) => {
    try {
      const { data, error } = await supabase.functions.invoke('pbx-sms-send', { body: { to, body } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      if (emailAccount?.id) await supabase.functions.invoke('pbx-email-sync', { body: {} });
      await reload();
    } finally {
      setSyncing(false);
    }
  };

  // Mark SMS read when opening.
  useEffect(() => {
    if (active?.type !== 'sms') return;
    const ids = sms
      .filter((m) => smsKey(m) === active.key && m.direction === 'inbound' && !m.is_read)
      .map((m) => m.id);
    if (!ids.length) return;
    supabase.from('pbx_sms_messages').update({ is_read: true }).in('id', ids).then(() => {});
  }, [active, sms]);

  const activeSmsMessages = useMemo(() => {
    if (active?.type !== 'sms') return [];
    return sms.filter((m) => smsKey(m) === active.key);
  }, [active, sms]);

  const activeEmailMessages = useMemo(() => {
    if (active?.type !== 'email') return [];
    return emails.filter((m) => m.gmail_thread_id === active.key);
  }, [active, emails]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5" /> Unified Inbox
            </CardTitle>
            <CardDescription>
              All your SMS and email in one chronological feed. Reply in-place using the original channel.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <div className="h-full grid grid-cols-[380px,1fr] divide-x">
          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search across SMS + email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {!emailAccount ? 'Connect Gmail in the Email tab to start seeing emails here. ' : ''}
                  {search ? 'No matches.' : 'No messages yet.'}
                </div>
              ) : (
                filtered.map((it) => (
                  <button
                    key={`${it.type}:${it.key}`}
                    onClick={() => setActive({ type: it.type, key: it.key })}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-muted transition-colors ${
                      active?.type === it.type && active?.key === it.key ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                        it.type === 'sms' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {it.type === 'sms' ? 'SMS' : 'Email'}
                      </span>
                      <div className={`flex-1 text-sm truncate ${it.unread ? 'font-semibold' : ''}`}>{it.title}</div>
                      <div className="text-[11px] text-muted-foreground shrink-0">{formatTime(new Date(it.ts).toISOString())}</div>
                    </div>
                    {it.subject && (
                      <div className={`text-sm truncate mt-0.5 ${it.unread ? 'font-semibold' : ''}`}>{it.subject}</div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="text-xs text-muted-foreground truncate flex-1">{it.preview}</div>
                      {it.unread > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 text-[11px] font-semibold rounded-full bg-primary text-primary-foreground px-1.5">
                          {it.unread}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>
          <div className="flex flex-col min-h-0">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <div>Select a message to open it.</div>
                  <div className="mt-1 text-xs">Replies use the original channel automatically.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-3 py-2 border-b flex items-center justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setActive(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  {active.type === 'sms' ? (
                    <SmsThreadInline
                      threadKey={active.key}
                      messages={activeSmsMessages}
                      onSend={handleSendSms}
                    />
                  ) : (
                    <EmailThread
                      threadId={active.key}
                      messages={activeEmailMessages}
                      account={emailAccount}
                      onMarkRead={() => reload()}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedInboxView;
