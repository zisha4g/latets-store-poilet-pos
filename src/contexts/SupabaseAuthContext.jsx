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
    const { error } = await supabase.auth.signUp({
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

    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
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

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, session, loading, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};