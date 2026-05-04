import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Rocket, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Landing page for the password-reset link in the branded email.
 * Supabase appends a recovery token to the URL hash, supabase-js detects it,
 * fires the PASSWORD_RECOVERY auth event and creates a temporary session that
 * lets us call updateUser({ password }) without a current password.
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1. Listen for the recovery event from supabase-js.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setRecoveryError('');
      }
    });

    // 2. Fallback: if we already have a session (e.g. supabase-js processed
    // the hash before our listener attached), allow the form immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.session) setReady(true);
    });

    // 3. If the URL has an error hash (expired / invalid link), surface it.
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const description = params.get('error_description') || params.get('error') || 'Link expired';
      setRecoveryError(description.replace(/\+/g, ' '));
    }

    return () => { cancelled = true; sub?.subscription?.unsubscribe?.(); };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Too short', description: 'Use at least 6 characters.' });
      return;
    }
    if (password !== confirm) {
      toast({ variant: 'destructive', title: 'Passwords do not match', description: 'Re-type the same password.' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ variant: 'destructive', title: 'Could not update password', description: error.message });
        return;
      }
      setDone(true);
      toast({ title: 'Password updated', description: 'You are signed in. Redirecting…' });
      setTimeout(() => navigate('/app', { replace: true }), 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reset password — StorePilot</title>
      </Helmet>
      <div className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md p-8 space-y-7 bg-card border border-border rounded-2xl shadow-xl"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
              {done ? <CheckCircle2 className="w-7 h-7 text-primary" /> : <Rocket className="w-7 h-7 text-primary" />}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {done ? 'Password updated' : 'Choose a new password'}
            </h1>
            {!done && (
              <p className="text-sm text-muted-foreground mt-2">
                Pick something you'll remember. At least 6 characters.
              </p>
            )}
          </div>

          {recoveryError && !ready && !done && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <p className="font-medium">This reset link is no longer valid.</p>
              <p className="text-xs mt-1 opacity-80">{recoveryError}</p>
              <Link to="/login" className="text-xs underline mt-2 inline-block">Request a new one</Link>
            </div>
          )}

          {!ready && !recoveryError && !done && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying your link…
            </div>
          )}

          {ready && !done && (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>

              <Button type="submit" className="w-full font-semibold py-3" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          )}

          {done && (
            <p className="text-center text-sm text-muted-foreground">
              Taking you to your dashboard…
            </p>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default ResetPasswordPage;
