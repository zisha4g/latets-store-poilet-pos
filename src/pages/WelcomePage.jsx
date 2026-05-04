import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';

const WelcomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user || null);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user || null);
      setChecking(false);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const goToApp = () => {
    if (user) navigate('/app', { replace: true });
    else navigate('/login', { replace: true });
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg p-8 space-y-6 bg-white dark:bg-card rounded-2xl shadow-xl text-center"
      >
        <div className="inline-block p-4 bg-primary/10 rounded-2xl">
          <Rocket className="w-10 h-10 text-primary" />
        </div>

        <div>
          <h1 className="text-3xl font-bold text-primary">Welcome to StorePilot</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your email is confirmed. One last step before you can sign in.
          </p>
        </div>

        <div className="text-left space-y-3 bg-muted/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Email verified</div>
              <div className="text-xs text-muted-foreground">
                {user?.email ? user.email : 'Your address is confirmed.'}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Awaiting admin approval</div>
              <div className="text-xs text-muted-foreground">
                We review every new account to keep the platform safe. You'll get an email when it's ready — usually within one business day.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button onClick={goToApp} className="w-full pos-button font-semibold" disabled={checking}>
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Need to come back later?{' '}
            <Link to="/" className="text-primary hover:underline">Return to home</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default WelcomePage;
