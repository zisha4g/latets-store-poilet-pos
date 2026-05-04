import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast.js';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (session) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);

    // Ensure a user_profiles row exists for users who signed up while
    // email confirmation was required (profile insert was deferred).
    const u = session?.user;
    if (u?.id) {
      try {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('user_id', u.id)
          .maybeSingle();
        if (!existing) {
          const md = u.user_metadata || {};
          if (md.store_name || md.full_name) {
            await supabase.from('user_profiles').insert({
              user_id: u.id,
              full_name: md.full_name || null,
              phone: md.phone || null,
              store_name: md.store_name || null,
              business_type: md.business_type || 'retail',
              approval_status: 'pending',
            });
          }
        }
      } catch (_) {
        // Non-fatal; user can still sign in.
      }
    }
  }, []);

  const applyKioskCredentials = useCallback(async (credentials, { persist = false, clearInstaller = false } = {}) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      if (clearInstaller) {
        await window.electronAPI?.clearInstallerCredentials?.();
      }
      await window.electronAPI?.clearKioskCredentials?.();
      handleSession(null);
      return false;
    }

    if (persist) {
      const saveResult = await window.electronAPI?.saveKioskCredentials?.(credentials);
      if (saveResult?.ok) {
        if (clearInstaller) {
          await window.electronAPI?.clearInstallerCredentials?.();
        }
      } else if (saveResult?.error) {
        toast({
          variant: "destructive",
          title: "Kiosk Save Failed",
          description: saveResult.error,
        });
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    handleSession(session);
    return true;
  }, [handleSession, toast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        handleSession(session);
      }
    );

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (window.electronAPI?.getKioskCredentials) {
        const installerCreds = await window.electronAPI.getInstallerCredentials?.();
        const kioskCreds = await window.electronAPI.getKioskCredentials();
        const desiredCreds = installerCreds || kioskCreds;

        if (desiredCreds) {
          const currentEmail = session?.user?.email || null;

          if (currentEmail !== desiredCreds.email) {
            if (session) {
              await supabase.auth.signOut({ scope: 'local' });
            }

            await applyKioskCredentials(desiredCreds, {
              persist: !!installerCreds,
              clearInstaller: !!installerCreds,
            });
            return;
          }

          if (installerCreds) {
            await window.electronAPI.saveKioskCredentials?.(installerCreds);
            await window.electronAPI.clearInstallerCredentials?.();
          }

          handleSession(session);
          return;
        }
      }

      handleSession(session);
    };

    getSession();

    return () => subscription.unsubscribe();
  }, [applyKioskCredentials, handleSession]);

  const signUp = useCallback(async (email, password, options) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { data, error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const isBanned = msg.includes('banned') || msg.includes('disabled') || error.code === 'user_banned';
      if (!isBanned) {
        toast({
          variant: "destructive",
          title: "Sign in Failed",
          description: error.message || "Something went wrong",
        });
      }
    }

    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign out Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const resetPassword = useCallback(async (email) => {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error.message || "Couldn't send the reset email.",
      });
    }

    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }), [user, session, loading, signUp, signIn, signOut, resetPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};