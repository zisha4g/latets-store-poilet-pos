import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Send, Plus, Search, RefreshCw, Inbox, Paperclip } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useEmailAccount } from '@/hooks/useEmailAccount';

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

const counterpart = (m, myEmail) => {
  if (m.direction === 'outbound') return (m.to_addrs || [])[0] || '';
  return m.from_addr || '';
};

const displayName = (m, myEmail) => {
  if (m.direction === 'outbound') return (m.to_addrs || [])[0] || '';
  return m.from_name || m.from_addr || '';
};

/** Empty / connect-Gmail panel. */
const ConnectGmailPanel = ({ onConnect, busy }) => (
  <Card className="max-w-xl mx-auto mt-12">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Connect Gmail</CardTitle>
      <CardDescription>
        Connect your Google account to view and reply to email from the PBX console.
        We use Gmail to read your inbox and send replies. You can disconnect at any time.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button onClick={onConnect} disabled={busy}>
        {busy ? 'Opening Google…' : 'Connect Gmail account'}
      </Button>
    </CardContent>
  </Card>
);

/**
 * EmailThread — reusable thread+composer for a single Gmail thread.
 * Exported so UnifiedInboxView can reuse it.
 */
export const EmailThread = ({ threadId, messages, account, onMarkRead }) => {
  const [activeMsgId, setActiveMsgId] = useState(null);
  const [bodyCache, setBodyCache] = useState({}); // gmail_message_id -> { html, text, attachments }
  const [loadingBody, setLoadingBody] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const iframeRef = useRef(null);

  const ordered = useMemo(
    () => [...messages].sort((a, b) => new Date(a.internal_date) - new Date(b.internal_date)),
    [messages],
  );

  // Default-open the latest message.
  useEffect(() => {
    if (!ordered.length) return;
    const last = ordered[ordered.length - 1];
    if (!activeMsgId) setActiveMsgId(last.id);
  }, [ordered, activeMsgId]);

  const activeMsg = ordered.find((m) => m.id === activeMsgId);

  const loadBody = useCallback(async (m) => {
    if (!m || bodyCache[m.gmail_message_id]) return;
    setLoadingBody(true);
    try {
      const { data, error } = await supabase.functions.invoke('pbx-email-fetch', {
        body: { message_id: m.gmail_message_id, markRead: !m.is_read },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setBodyCache((prev) => ({
        ...prev,
        [m.gmail_message_id]: {
          html: data.html || '',
          text: data.text || '',
          attachments: data.attachments || [],
        },
      }));
      if (!m.is_read) onMarkRead?.(m.id);
    } catch (e) {
      toast({ title: 'Could not load message', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingBody(false);
    }
  }, [bodyCache, onMarkRead]);

  useEffect(() => { if (activeMsg) loadBody(activeMsg); }, [activeMsg?.id]); // eslint-disable-line

  // Render HTML body inside sandboxed iframe.
  useEffect(() => {
    const iframe = iframeRef.current;
    const body = activeMsg && bodyCache[activeMsg.gmail_message_id];
    if (!iframe || !body) return;
    const html = body.html || `<pre style="font-family:inherit;white-space:pre-wrap">${(body.text || '').replace(/[<&]/g, (c) => ({ '<': '&lt;', '&': '&amp;' }[c]))}</pre>`;
    const wrapped = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#222;padding:8px}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
    iframe.srcdoc = wrapped;
  }, [activeMsg, bodyCache]);

  const downloadAttachment = async (att) => {
    if (!activeMsg) return;
    try {
      const { data, error } = await supabase.functions.invoke('pbx-email-attachment', {
        body: {
          message_id: activeMsg.gmail_message_id,
          attachment_id: att.attachmentId,
          mime_type: att.mimeType,
          filename: att.filename,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const a = document.createElement('a');
      a.href = `data:${data.mimeType};base64,${data.base64}`;
      a.download = data.filename;
      a.click();
    } catch (e) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !ordered.length) return;
    setSending(true);
    try {
      // Reply to the latest message so headers thread correctly.
      const last = ordered[ordered.length - 1];
      const replyTo = last.direction === 'outbound' ? (last.to_addrs || [])[0] : last.from_addr;
      if (!replyTo) throw new Error('no recipient');
      const { data, error } = await supabase.functions.invoke('pbx-email-send', {
        body: {
          to: replyTo,
          subject: '', // function will derive Re: from source
          body_text: replyText,
          reply_to_message_id: last.gmail_message_id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setReplyText('');
      setReplyOpen(false);
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (!ordered.length) return null;
  const subject = ordered[0].subject || '(no subject)';
  const body = activeMsg && bodyCache[activeMsg.gmail_message_id];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b">
        <div className="font-semibold truncate">{subject}</div>
        <div className="text-xs text-muted-foreground">{ordered.length} message{ordered.length === 1 ? '' : 's'}</div>
      </div>
      <div className="flex-1 min-h-0 grid grid-rows-[auto,1fr]">
        {/* Message list strip */}
        <div className="border-b max-h-40 overflow-y-auto">
          {ordered.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMsgId(m.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted ${
                activeMsgId === m.id ? 'bg-primary/5' : ''
              } ${!m.is_read ? 'font-semibold' : ''}`}
            >
              <div className="flex justify-between gap-2">
                <span className="truncate">{displayName(m, account?.email)}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatTime(m.internal_date)}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{m.snippet}</div>
            </button>
          ))}
        </div>
        {/* Body pane */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 bg-muted/10">
            {loadingBody && !body ? (
              <div className="p-6 text-sm text-muted-foreground">Loading message…</div>
            ) : body ? (
              <iframe
                ref={iframeRef}
                title="email-body"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="w-full h-full border-0 bg-white"
              />
            ) : null}
          </div>
          {body?.attachments?.length > 0 && (
            <div className="px-3 py-2 border-t text-xs flex flex-wrap gap-2">
              {body.attachments.map((att) => (
                <button
                  key={att.attachmentId}
                  onClick={() => downloadAttachment(att)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-muted"
                >
                  <Paperclip className="w-3 h-3" />
                  {att.filename}
                </button>
              ))}
            </div>
          )}
          <div className="border-t p-3">
            {replyOpen ? (
              <div className="space-y-2">
                <Textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply…"
                  className="resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setReplyOpen(false); setReplyText(''); }}>Cancel</Button>
                  <Button size="sm" onClick={sendReply} disabled={sending || !replyText.trim()}>
                    <Send className="w-3.5 h-3.5 mr-1" />{sending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setReplyOpen(true)}>Reply</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ComposeDialog = ({ open, onClose, defaultTo = '' }) => {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { if (open) { setTo(defaultTo); setSubject(''); setBody(''); } }, [open, defaultTo]);
  if (!open) return null;
  const send = async () => {
    if (!to.trim() || !body.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('pbx-email-send', {
        body: { to, subject, body_text: body },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      onClose();
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg flex flex-col">
        <div className="p-3 border-b font-semibold">New message</div>
        <div className="p-3 space-y-2">
          <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea rows={8} placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} className="resize-none" />
        </div>
        <div className="p-3 border-t flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={sending || !to.trim() || !body.trim()}>
            <Send className="w-4 h-4 mr-1" />{sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const EmailView = () => {
  const { user } = useAuth();
  const { account, loading: accountLoading, busy, connect } = useEmailAccount();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeThread, setActiveThread] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pbx_email_messages')
      .select('*')
      .order('internal_date', { ascending: false })
      .limit(500);
    if (!error) setMessages(data || []);
    setLoading(false);
  }, [user?.id]);

  // Initial load + on-tab-open server sync.
  useEffect(() => {
    if (!account?.id || !user?.id) return;
    reload();
    (async () => {
      setSyncing(true);
      try { await supabase.functions.invoke('pbx-email-sync', { body: {} }); }
      finally { setSyncing(false); reload(); }
    })();
  }, [account?.id, user?.id, reload]);

  // Realtime mirror updates.
  useEffect(() => {
    if (!user?.id) return undefined;
    const ch = supabase
      .channel(`pbx-email-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_email_messages', filter: `user_id=eq.${user.id}` },
        (p) => setMessages((prev) => prev.some((m) => m.id === p.new.id) ? prev : [p.new, ...prev]))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pbx_email_messages', filter: `user_id=eq.${user.id}` },
        (p) => setMessages((prev) => prev.map((m) => (m.id === p.new.id ? p.new : m))))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pbx_email_messages', filter: `user_id=eq.${user.id}` },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== p.old.id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Group by gmail_thread_id.
  const threads = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      const key = m.gmail_thread_id;
      if (!key) continue;
      const t = map.get(key) || { key, messages: [], last: null, unread: 0, subject: '' };
      t.messages.push(m);
      if (!m.is_read && m.direction === 'inbound') t.unread += 1;
      if (!t.last || new Date(m.internal_date) > new Date(t.last.internal_date)) {
        t.last = m;
        t.subject = m.subject || t.subject;
      }
      map.set(key, t);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.last?.internal_date || 0) - new Date(a.last?.internal_date || 0));
    return list;
  }, [messages]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      (t.subject || '').toLowerCase().includes(q) ||
      t.messages.some((m) =>
        (m.from_addr || '').toLowerCase().includes(q) ||
        (m.from_name || '').toLowerCase().includes(q) ||
        (m.snippet || '').toLowerCase().includes(q),
      ),
    );
  }, [threads, search]);

  const activeThreadMessages = useMemo(() => {
    if (!activeThread) return [];
    return messages.filter((m) => m.gmail_thread_id === activeThread);
  }, [activeThread, messages]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('pbx-email-sync', { body: {} });
      if (error) throw new Error(error.message);
      await reload();
    } catch (e) {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const markRead = useCallback((rowId) => {
    setMessages((prev) => prev.map((m) => (m.id === rowId ? { ...m, is_read: true } : m)));
  }, []);

  if (accountLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!account) {
    return <ConnectGmailPanel onConnect={connect} busy={busy} />;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" /> Email
            </CardTitle>
            <CardDescription>Connected as {account.email}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Compose
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <div className="h-full grid grid-cols-[360px,1fr] divide-x">
          {/* Thread list */}
          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search subject, sender or snippet"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading…</div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {search ? 'No matching messages.' : 'No emails yet.'}
                </div>
              ) : (
                filteredThreads.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveThread(t.key)}
                    className={`w-full text-left px-4 py-3 border-b hover:bg-muted transition-colors ${
                      activeThread === t.key ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-sm truncate ${t.unread ? 'font-semibold' : ''}`}>
                        {displayName(t.last, account.email) || counterpart(t.last, account.email)}
                      </div>
                      <div className="text-[11px] text-muted-foreground shrink-0">{formatTime(t.last?.internal_date)}</div>
                    </div>
                    <div className={`text-sm truncate ${t.unread ? 'font-semibold' : ''}`}>{t.subject || '(no subject)'}</div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="text-xs text-muted-foreground truncate flex-1">{t.last?.snippet}</div>
                      {t.unread > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 text-[11px] font-semibold rounded-full bg-primary text-primary-foreground px-1.5">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>
          {/* Thread detail */}
          <div className="min-h-0">
            {activeThread ? (
              <EmailThread
                threadId={activeThread}
                messages={activeThreadMessages}
                account={account}
                onMarkRead={markRead}
              />
            ) : (
              <div className="flex-1 h-full flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <div>Select a message or compose a new one.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </Card>
  );
};

export default EmailView;
