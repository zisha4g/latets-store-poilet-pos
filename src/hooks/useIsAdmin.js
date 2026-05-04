import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

let cached = null; // { userId, isAdmin } module-level cache to avoid re-checks

export const useIsAdmin = (user) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      setIsAdmin(false);
      return;
    }
    if (cached && cached.userId === user.id) {
      setIsAdmin(cached.isAdmin);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('voice-admin', {
          body: { action: 'get_admin_context' },
        });
        if (cancelled) return;
        const ok = !error && !!data?.isAdmin;
        cached = { userId: user.id, isAdmin: ok };
        setIsAdmin(ok);
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { loading, isAdmin };
};
