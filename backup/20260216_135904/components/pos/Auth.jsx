import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const Auth = ({ mode = 'login' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = mode === 'login';

  useEffect(() => {
    if (!isLogin) return;
    const clearSession = async () => {
      try {
        await signOut();
      } catch (error) {
        console.warn('Failed to clear auth session on login page:', error);
      }
    };
    clearSession();
  }, [isLogin, signOut]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const action = isLogin ? signIn : signUp;
      const { error } = await action({ email, password });

      if (error) {
        throw error;
      }

      toast({
        title: isLogin ? 'Login Successful' : 'Signup Successful',
        description: 'Redirecting...',
      });

      const redirectTo = location.state?.from ?? '/app';
      navigate(redirectTo, { replace: true });
    } catch (authError) {
      toast({
        title: 'Authentication Failed',
        description: authError?.message || 'Please check your credentials and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="absolute top-6 left-6">
        <Button asChild variant="outline">
          <Link to="/">← Back to Home</Link>
        </Button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-card rounded-2xl shadow-xl"
      >
        <div className="text-center">
          <div className="inline-block p-4 bg-primary/10 rounded-2xl mb-4">
            <KeyRound className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary">Welcome to Key POS</h1>
          <p className="text-muted-foreground mt-2">The Key to Smarter Retail.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full pos-button font-semibold py-3" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up & Start Trial')}
          </Button>
        </form>
        <div className="text-center">
          {isLogin ? (
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
