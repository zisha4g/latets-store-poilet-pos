import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Returns the current user's approval status from `user_profiles`.
 * Possible status values: 'pending' | 'approved' | 'rejected' | 'missing'.
 * 'missing' means no profile row exists yet (legacy users / pre-approval signups).
 */
export const useApprovalStatus = (user) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      setStatus(null);
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [profileRes, adminRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('approval_status, rejection_reason, store_name, full_name')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('platform_admins')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const { data, error } = profileRes;
        const adminFlag = !adminRes.error && !!adminRes.data;
        setIsAdmin(adminFlag);
        if (error) {
          // If table doesn't exist yet or query fails, assume legacy 'missing'.
          setStatus('missing');
          setProfile(null);
        } else if (!data) {
          setStatus('missing');
          setProfile(null);
        } else {
          setStatus(data.approval_status);
          setProfile(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { loading, status, profile, isAdmin };
};
