import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

export default function KioskSetupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRetry, setIsRetry] = useState(false);

  useEffect(() => {
    // Check if credentials were saved before (failed login scenario)
    const checkExisting = async () => {
      if (window.electronAPI?.getKioskCredentials) {
        const creds = await window.electronAPI.getKioskCredentials();
        if (creds) {
          setIsRetry(true);
          setEmail(creds.email);
        }
      }
    };
    checkExisting();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Verify credentials work before saving
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message || 'Invalid email or password. Please try again.');
      setLoading(false);
      return;
    }

    // Save credentials to encrypted local config
    if (window.electronAPI?.saveKioskCredentials) {
      const result = await window.electronAPI.saveKioskCredentials({ email, password });
      if (!result.ok) {
        setError('Failed to save credentials: ' + (result.error || 'Unknown error'));
        setLoading(false);
        return;
      }
    }

    // Navigate to kiosk
    navigate('/selfcheckout', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isRetry ? 'Update Kiosk Account' : 'Kiosk Setup'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {isRetry
              ? 'Your saved credentials could not sign in. Please update them.'
              : 'Enter your StorePilot account credentials. The kiosk will sign in automatically on every launch.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg px-4 py-3 transition-colors"
          >
            {loading ? 'Verifying…' : isRetry ? 'Update & Continue' : 'Save & Launch Kiosk'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Credentials are encrypted and stored locally on this machine only.
        </p>
      </div>
    </div>
  );
}
