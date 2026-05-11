import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Plus, Search, Phone } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

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

const normalizePhone = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
};

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

const SmsView = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [newThreadTo, setNewThreadTo] = useState('');
  const scrollRef = useRef(null);

  // Load all messages for this user.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('pbx_sms_messages')
        .select('*')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Failed to load messages', description: error.message, variant: 'destructive' });
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Realtime — both inbound (from webhook) and outbound (from this client or other tabs).
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`pbx-sms-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_sms_messages', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pbx_sms_messages', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Group messages into threads keyed by counterpart number.
  const threads = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      const key = m.thread_key || (m.direction === 'inbound' ? m.from_number : m.to_number);
      if (!key) continue;
      const existing = map.get(key) || { key, messages: [], unread: 0, last: null };
      existing.messages.push(m);
      if (m.direction === 'inbound' && !m.is_read) existing.unread += 1;
      if (!existing.last || new Date(m.created_at) > new Date(existing.last.created_at)) {
        existing.last = m;
      }
      map.set(key, existing);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.last?.created_at || 0) - new Date(a.last?.created_at || 0));
    return list;
  }, [messages]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      if (t.key.toLowerCase().includes(q)) return true;
      return t.messages.some((m) => (m.body || '').toLowerCase().includes(q));
    });
  }, [threads, search]);

  const activeThreadMessages = useMemo(() => {
    if (!activeThread) return [];
    return messages
      .filter((m) => (m.thread_key || (m.direction === 'inbound' ? m.from_number : m.to_number)) === activeThread)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [activeThread, messages]);

  // Auto-scroll to bottom when active thread changes or grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeThread, activeThreadMessages.length]);

  // Mark inbound as read when opening a thread.
  useEffect(() => {
    if (!activeThread) return;
    const unreadIds = messages
      .filter((m) => (m.thread_key || m.from_number) === activeThread && m.direction === 'inbound' && !m.is_read)
      .map((m) => m.id);
    if (!unreadIds.length) return;
    supabase
      .from('pbx_sms_messages')
      .update({ is_read: true })
      .in('id', unreadIds)
      .then(({ error }) => {
        if (error) console.warn('[sms] mark read failed', error);
      });
  }, [activeThread, messages]);

  const handleSend = async () => {
    const body = composeBody.trim();
    const to = activeThread;
    if (!body || !to) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('pbx-sms-send', {
        body: { to, body },
      });
      if (error) throw new Error(error.message || 'send failed');
      if (data?.error) throw new Error(data.error);
      setComposeBody('');
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleStartNewThread = async () => {
    const to = normalizePhone(newThreadTo);
    if (!to || to.length < 4) {
      toast({ title: 'Enter a valid phone number', variant: 'destructive' });
      return;
    }
    setActiveThread(to);
    setNewThreadOpen(false);
    setNewThreadTo('');
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> SMS / MMS
        </CardTitle>
        <CardDescription>Inbound and outbound text messages for your business numbers.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <div className="h-full grid grid-cols-[320px,1fr] divide-x">
          {/* Thread list */}
          <div className="flex flex-col min-h-0">
            <div className="p-3 border-b flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search number or text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => setNewThreadOpen((v) => !v)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {newThreadOpen && (
              <div className="p-3 border-b bg-muted/30 space-y-2">
                <Input
                  placeholder="+1 555 555 1234"
                  value={newThreadTo}
                  onChange={(e) => setNewThreadTo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStartNewThread(); }}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setNewThreadOpen(false); setNewThreadTo(''); }}>Cancel</Button>
                  <Button size="sm" onClick={handleStartNewThread}>Start</Button>
                </div>
              </div>
            )}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading…</div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {search ? 'No matching threads.' : 'No messages yet. Use + to start a conversation.'}
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
                    <div className="flex items-center justify-between">
                      <div className="font-medium font-mono text-sm">{formatPhone(t.key)}</div>
                      <div className="text-[11px] text-muted-foreground">{formatTime(t.last?.created_at)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="text-xs text-muted-foreground truncate flex-1">
                        {t.last?.direction === 'outbound' ? 'You: ' : ''}
                        {t.last?.body || (t.last?.num_media ? `[${t.last.num_media} media]` : '')}
                      </div>
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
          <div className="flex flex-col min-h-0">
            {activeThread ? (
              <>
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono font-medium">{formatPhone(activeThread)}</span>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                  {activeThreadMessages.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No messages in this thread yet. Send the first one below.
                    </div>
                  ) : (
                    activeThreadMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          m.direction === 'outbound'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border'
                        }`}>
                          {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                          {Array.isArray(m.media_urls) && m.media_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="block mt-1 underline text-xs opacity-80">
                              media {i + 1}
                            </a>
                          ))}
                          <div className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {formatTime(m.created_at)}{m.status && m.direction === 'outbound' ? ` · ${m.status}` : ''}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t flex gap-2 items-end">
                  <Textarea
                    rows={2}
                    placeholder="Type a message…"
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    className="resize-none"
                  />
                  <Button onClick={handleSend} disabled={sending || !composeBody.trim()}>
                    <Send className="w-4 h-4 mr-1" />
                    {sending ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a thread or start a new one with the + button.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmsView;
