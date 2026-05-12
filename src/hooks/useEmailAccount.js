import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

/**
 * useEmailAccount — loads the current user's connected Gmail account row
 * from pbx_email_accounts (single account per user).
 *
 * Returns: { account, loading, refresh, connect, disconnect }
 */
export function useEmailAccount() {
  const { user, session } = useAuth();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setAccount(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('pbx_email_accounts')
      .select('id, email, connected_at, history_id, watch_expiration')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!error) setAccount(data || null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // React to inserts/deletes via realtime (handy for OAuth popup completion).
  useEffect(() => {
    if (!user?.id) return undefined;
    const ch = supabase
      .channel(`pbx-email-account-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pbx_email_accounts', filter: `user_id=eq.${user.id}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, load]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('pbx-email-oauth-start', { body: {} });
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('no auth url returned');
      // Open in a popup so the SPA stays mounted; realtime / polling will pick up the new row.
      const popup = window.open(data.url, 'gmail-oauth', 'width=520,height=720');
      if (!popup) {
        // Popup blocked — fall back to current-window redirect.
        window.location.href = data.url;
        return;
      }
      // Poll until the row appears (account creation triggers realtime too).
      const start = Date.now();
      const poll = setInterval(async () => {
        await load();
        if (popup.closed || Date.now() - start > 5 * 60 * 1000) {
          clearInterval(poll);
        }
      }, 1500);
    } finally {
      setBusy(false);
    }
  }, [load]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await supabase.functions.invoke('pbx-email-disconnect', { body: {} });
      await load();
    } finally {
      setBusy(false);
    }
  }, [load]);

  return { account, loading, busy, refresh: load, connect, disconnect, session };
}

export default useEmailAccount;
