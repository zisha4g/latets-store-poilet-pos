import React from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck,
  Users,
  Phone,
  Mic,
  ScrollText,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import { useIsAdmin } from '@/hooks/useIsAdmin.js';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';

const adminNav = [
  { to: '/admin/users', icon: Users, label: 'Users & Approvals' },
  { to: '/admin/phone-numbers', icon: Phone, label: 'Phone Numbers' },
  { to: '/admin/voice-ordering', icon: Mic, label: 'Voice Ordering' },
  { to: '/admin/audit-log', icon: ScrollText, label: 'Audit Log' },
];

const linkClass = ({ isActive }) =>
  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

const AdminLayout = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: adminLoading, isAdmin } = useIsAdmin(user);
  const navigate = useNavigate();

  if (authLoading || adminLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-lg animate-pulse">Verifying admin access…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      <Helmet>
        <title>Admin – StorePilot</title>
      </Helmet>
      <div className="min-h-screen bg-secondary text-foreground">
        <div className="flex h-screen">
          <aside className="w-64 bg-card border-r flex flex-col p-4">
            <div className="flex items-center mb-8">
              <ShieldCheck className="w-7 h-7 text-primary mr-2" />
              <h1 className="text-xl font-bold">Admin</h1>
            </div>
            <nav className="flex-grow space-y-1">
              {adminNav.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass}>
                  <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto pt-4 space-y-2 border-t">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/app')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to app
              </Button>
              <div className="text-xs text-muted-foreground px-2 truncate">{user.email}</div>
              <Button variant="ghost" className="w-full justify-start" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </Button>
            </div>
          </aside>
          <main className="flex-1 overflow-auto p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
        <Toaster />
      </div>
    </>
  );
};

export default AdminLayout;
