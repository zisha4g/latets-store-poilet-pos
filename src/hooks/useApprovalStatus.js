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
          // No profile row yet. If the user signed up via the wizard
          // (store_name in their metadata), backfill the row now and
          // treat as pending. Otherwise leave as 'missing' (legacy).
          const md = user.user_metadata || {};
          const cameFromSignup = !!(md.store_name || md.business_type);
          if (cameFromSignup) {
            const { data: inserted, error: insErr } = await supabase
              .from('user_profiles')
              .insert({
                user_id: user.id,
                full_name: md.full_name || null,
                phone: md.phone || null,
                store_name: md.store_name || null,
                business_type: md.business_type || 'retail',
                approval_status: 'pending',
              })
              .select('approval_status, rejection_reason, store_name, full_name')
              .maybeSingle();
            if (cancelled) return;
            if (!insErr && inserted) {
              setStatus(inserted.approval_status);
              setProfile(inserted);
            } else {
              // Insert blocked (e.g. row already created by another tab).
              // Re-read once to pick up the existing row.
              const { data: retry } = await supabase
                .from('user_profiles')
                .select('approval_status, rejection_reason, store_name, full_name')
                .eq('user_id', user.id)
                .maybeSingle();
              if (cancelled) return;
              if (retry) {
                setStatus(retry.approval_status);
                setProfile(retry);
              } else {
                setStatus('pending');
                setProfile(null);
              }
            }
          } else {
            setStatus('missing');
            setProfile(null);
          }
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
