import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

const businessTypes = [
  { value: 'retail', label: 'Retail' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'service', label: 'Service' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'other', label: 'Other' },
];

const SignupWizard = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    storeName: '',
    businessType: 'retail',
  });

  const update = (field) => (e) => setForm((s) => ({ ...s, [field]: e.target.value }));

  const goNext = (e) => {
    e?.preventDefault?.();
    if (!form.email || !form.password || !form.fullName || !form.phone) {
      toast({ title: 'Missing info', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: 'Weak password', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.storeName) {
      toast({ title: 'Store name required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/welcome`
        : undefined;
      const { data, error } = await signUp(form.email, form.password, {
        emailRedirectTo,
        data: {
          full_name: form.fullName,
          phone: form.phone || null,
          store_name: form.storeName,
          business_type: form.businessType,
        },
      });
      if (error) throw error;

      const userId = data?.user?.id;
      const hasSession = !!data?.session;

      // If email confirmation is required, Supabase returns a user but no session.
      // Show the "check your email" screen — profile insert will happen after first login.
      if (!hasSession) {
        setVerifySent(true);
        return;
      }

      // Session exists: insert profile now.
      if (!userId) throw new Error('Missing user id');
      const { error: profileError } = await supabase.from('user_profiles').insert({
        user_id: userId,
        full_name: form.fullName,
        phone: form.phone || null,
        store_name: form.storeName,
        business_type: form.businessType,
        approval_status: 'pending',
      });
      if (profileError) throw profileError;

      toast({ title: 'Account created', description: 'Awaiting admin approval.' });
      navigate('/pending-approval', { replace: true });
    } catch (err) {
      toast({
        title: 'Signup failed',
        description: err?.message || 'Please try again.',
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

      {verifySent ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-card rounded-2xl shadow-xl text-center"
        >
          <div className="inline-block p-4 bg-primary/10 rounded-2xl mb-2">
            <MailCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{form.email}</span>.
            <br />
            Click the link to verify your address, then sign in to finish setup.
          </p>
          <div className="text-xs text-muted-foreground">
            Didn't get it? Check your spam folder, or wait a minute and try again.
          </div>
          <Button asChild className="w-full pos-button font-semibold">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </motion.div>
      ) : (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-card rounded-2xl shadow-xl"
      >
        <div className="text-center">
          <div className="inline-block p-4 bg-primary/10 rounded-2xl mb-4">
            <Rocket className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Create your account</h1>
          <p className="text-muted-foreground mt-1 text-sm">Step {step} of 2</p>
        </div>

        {step === 1 ? (
          <form onSubmit={goNext} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={form.fullName} onChange={update('fullName')} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={update('email')} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={update('password')} required minLength={8} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={update('phone')} required disabled={loading} />
            </div>
            <Button type="submit" className="w-full pos-button font-semibold py-3">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" value={form.storeName} onChange={update('storeName')} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type</Label>
              <select
                id="businessType"
                value={form.businessType}
                onChange={update('businessType')}
                disabled={loading}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {businessTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={loading}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button type="submit" className="flex-1 pos-button font-semibold" disabled={loading}>
                {loading ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </form>
        )}

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
      )}
    </div>
  );
};

export default SignupWizard;
