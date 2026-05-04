import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Rocket, Eye, EyeOff, Loader2, ArrowLeft, Mail, ShieldAlert } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const VIEWS = { signIn: 'signIn', forgot: 'forgot' };

const Auth = ({ mode = 'login' }) => {
  const isLogin = mode === 'login';
  const [view, setView] = useState(VIEWS.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountBlocked, setAccountBlocked] = useState(null); // { email } when sign-in is blocked
  const { user, signIn, signUp, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const kioskMode = !!location.state?.kioskMode;

  const redirectTarget = useMemo(
    () => location.state?.from ?? (isElectron ? '/selfcheckout' : '/app'),
    [location.state, isElectron]
  );

  // On the login page, clear any lingering web session so users always start fresh.
  // In Electron / kiosk we keep it.
  useEffect(() => {
    if (!isLogin || isElectron) return;
    let cancelled = false;
    (async () => {
      try {
        await signOut();
      } catch (error) {
        if (!cancelled) console.warn('Failed to clear auth session on login page:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [isElectron, isLogin, signOut]);

  // If already signed in (e.g. signup just completed), redirect away from auth.
  useEffect(() => {
    if (!user) return;
    if (isLogin && !isElectron) return; // /login intentionally clears session
    navigate(redirectTarget, { replace: true });
  }, [user, isLogin, isElectron, navigate, redirectTarget]);

  const validate = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return 'That email address looks invalid.';
    if (view === VIEWS.forgot) return null;
    if (!password) return 'Please enter your password.';
    if (!isLogin && password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      toast({ variant: 'destructive', title: 'Check your details', description: problem });
      return;
    }

    setLoading(true);
    try {
      const action = isLogin ? signIn : signUp;
      const trimmedEmail = email.trim().toLowerCase();
      const { error } = await action(trimmedEmail, password);
      if (error) {
        const msg = (error.message || '').toLowerCase();
        const isBanned = msg.includes('banned') || msg.includes('disabled') || error.code === 'user_banned';
        if (isBanned && isLogin) {
          setAccountBlocked({ email: trimmedEmail });
        }
        return; // toast already shown by AuthContext (except for banned)
      }

      if (!isLogin) {
        toast({
          title: 'Account created',
          description: 'Check your inbox to confirm your email, then sign in.',
        });
      } else {
        toast({ title: 'Welcome back', description: 'Redirecting to your dashboard…' });
      }

      navigate(redirectTarget, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      toast({ variant: 'destructive', title: 'Check your email', description: problem });
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(email.trim().toLowerCase());
      if (error) return;
      toast({
        title: 'Check your email',
        description: 'We sent you a link to reset your password.',
      });
      setView(VIEWS.signIn);
    } finally {
      setLoading(false);
    }
  };

  const heading = view === VIEWS.forgot
    ? 'Reset your password'
    : 'StorePilot';
  const subheading = view === VIEWS.forgot
    ? "Enter your email and we'll send you a reset link."
    : null;

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      {!kioskMode && !isElectron && (
        <div className="absolute top-6 left-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back to Home</Link>
          </Button>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md p-8 space-y-7 bg-card border border-border rounded-2xl shadow-xl"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Rocket className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{heading}</h1>
          {subheading && <p className="text-sm text-muted-foreground mt-2">{subheading}</p>}
        </div>

        {accountBlocked ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold text-amber-900 dark:text-amber-200">Account awaiting review</div>
                <p className="text-amber-800 dark:text-amber-300/90 mt-1">
                  Your account ({accountBlocked.email}) hasn't been activated yet, or has been temporarily disabled by the StorePilot team.
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                If you just signed up, this usually clears within one business day after we review your details. You'll get an email when your account is ready.
              </p>
              <p>
                Questions or think this is a mistake? Contact us:
              </p>
              <a
                href="mailto:support@storepilot.com?subject=Account%20activation%20help"
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
              >
                <Mail className="w-4 h-4" /> support@storepilot.com
              </a>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => { setAccountBlocked(null); setPassword(''); }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to sign in
            </Button>
          </div>
        ) : view === VIEWS.signIn ? (
          <form onSubmit={handleAuthSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setView(VIEWS.forgot)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  minLength={isLogin ? undefined : 6}
                  disabled={loading}
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
              {!isLogin && (
                <p className="text-xs text-muted-foreground">Use at least 6 characters.</p>
              )}
            </div>

            <Button type="submit" className="w-full font-semibold py-3" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Please wait…</>
              ) : (
                isLogin ? 'Sign in' : 'Create account'
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full font-semibold py-3" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Send reset link</>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setView(VIEWS.signIn)}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to sign in
            </button>
          </form>
        )}

        {view === VIEWS.signIn && !accountBlocked && (
          <div className="text-center pt-4 border-t border-border">
            {isLogin ? (
              <p className="text-sm text-muted-foreground pt-4">
                Don't have an account?{' '}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Start a free trial
                </Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground pt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Auth;
