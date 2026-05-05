import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Plus, CheckCircle2, XCircle, RefreshCw, Ban, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'no_profile', label: 'No profile' },
];

const AdminUsersPage = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { kind, user, reason? }
  const [addForm, setAddForm] = useState({
    email: '', password: '', fullName: '', phone: '', storeName: '', businessType: 'retail',
  });

  const invokeAdmin = useCallback(async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('voice-admin', {
      body: { action, ...payload },
    });
    if (error) {
      let detail = error.message;
      try {
        const ctx = error.context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) detail = body.error;
        } else if (ctx && typeof ctx.text === 'function') {
          const txt = await ctx.text();
          if (txt) detail = txt;
        }
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadProfiles = useCallback(async (filter) => {
    setLoading(true);
    try {
      const data = await invokeAdmin('list_user_profiles', { statusFilter: filter });
      setProfiles(data?.profiles ?? []);
    } catch (err) {
      toast({ title: 'Failed to load users', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin, toast]);

  useEffect(() => { loadProfiles(statusFilter); }, [statusFilter, loadProfiles]);

  const handleApprove = async (userId) => {
    setBusyId(userId);
    try {
      await invokeAdmin('approve_user', { targetUserId: userId });
      toast({ title: 'User approved' });
      loadProfiles(statusFilter);
    } catch (err) {
      toast({ title: 'Approve failed', description: err.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const handleReject = (user) => {
    setConfirmAction({ kind: 'reject', user, reason: '' });
  };

  const handleToggleDisabled = (user) => {
    setConfirmAction({ kind: user.is_disabled ? 'enable' : 'disable', user });
  };

  const handleDelete = (user) => {
    setConfirmAction({ kind: 'delete', user });
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    const { kind, user, reason } = confirmAction;
    setBusyId(user.user_id);
    try {
      if (kind === 'reject') {
        await invokeAdmin('reject_user', { targetUserId: user.user_id, rejectionReason: reason || '' });
        toast({ title: 'User rejected' });
      } else if (kind === 'disable' || kind === 'enable') {
        await invokeAdmin('set_user_disabled', { targetUserId: user.user_id, disabled: kind === 'disable' });
        toast({ title: kind === 'disable' ? 'User disabled' : 'User enabled' });
      } else if (kind === 'delete') {
        await invokeAdmin('delete_user', { targetUserId: user.user_id });
        toast({ title: 'User deleted' });
      }
      setConfirmAction(null);
      loadProfiles(statusFilter);
    } catch (err) {
      toast({ title: `${kind} failed`, description: err.message, variant: 'destructive' });
    } finally { setBusyId(null); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.email || !addForm.password) {
      toast({ title: 'Email and password required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await invokeAdmin('add_user_manually', addForm);
      toast({ title: 'User created', description: 'Account is auto-approved.' });
      setShowAdd(false);
      setAddForm({ email: '', password: '', fullName: '', phone: '', storeName: '', businessType: 'retail' });
      setStatusFilter('approved');
    } catch (err) {
      toast({ title: 'Create failed', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users & Approvals</h1>
          <p className="text-muted-foreground">Approve new signups, reject, or add users manually.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadProfiles(statusFilter)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus className="w-4 h-4 mr-2" /> Add user
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add user manually</CardTitle>
            <CardDescription>Creates an approved account immediately.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-email">Email</Label>
                <Input id="add-email" type="email" required value={addForm.email}
                  onChange={(e) => setAddForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-password">Password</Label>
                <Input id="add-password" type="password" required minLength={8} value={addForm.password}
                  onChange={(e) => setAddForm((s) => ({ ...s, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-name">Full name</Label>
                <Input id="add-name" value={addForm.fullName}
                  onChange={(e) => setAddForm((s) => ({ ...s, fullName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-phone">Phone</Label>
                <Input id="add-phone" value={addForm.phone}
                  onChange={(e) => setAddForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-store">Store name</Label>
                <Input id="add-store" value={addForm.storeName}
                  onChange={(e) => setAddForm((s) => ({ ...s, storeName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-type">Business type</Label>
                <Input id="add-type" value={addForm.businessType}
                  onChange={(e) => setAddForm((s) => ({ ...s, businessType: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>Create user</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Store</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Signed up</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No users in this view.
                    </td>
                  </tr>
                )}
                {profiles.map((p) => (
                  <tr key={p.user_id} className={p.is_disabled ? 'bg-muted/30' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.full_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{p.email || p.user_id}</div>
                      {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div>{p.store_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{p.business_type || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium w-fit ${
                          p.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
                          p.approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          p.approval_status === 'no_profile' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {p.approval_status}
                        </span>
                        {p.is_disabled && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit">
                            <Ban className="w-3 h-3 mr-1" /> disabled
                          </span>
                        )}
                        {p.approval_status === 'rejected' && p.rejection_reason && (
                          <div className="text-xs text-muted-foreground">{p.rejection_reason}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.approval_status !== 'approved' && (
                          <Button size="sm" onClick={() => handleApprove(p.user_id)} disabled={busyId === p.user_id}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                        )}
                        {p.approval_status !== 'rejected' && (
                          <Button size="sm" variant="outline" onClick={() => handleReject(p)} disabled={busyId === p.user_id}>
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={p.is_disabled ? 'default' : 'outline'}
                          onClick={() => handleToggleDisabled(p)}
                          disabled={busyId === p.user_id}
                        >
                          {p.is_disabled ? (
                            <><ShieldCheck className="w-4 h-4 mr-1" /> Enable</>
                          ) : (
                            <><Ban className="w-4 h-4 mr-1" /> Disable</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDelete(p)}
                          disabled={busyId === p.user_id}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          {confirmAction && (() => {
            const { kind, user, reason } = confirmAction;
            const userLabel = user.email || user.full_name || user.user_id;
            const titles = {
              reject: 'Reject this user?',
              disable: 'Disable this user?',
              enable: 'Enable this user?',
              delete: 'Delete this user?',
            };
            const descriptions = {
              reject: 'They will not be able to access the dashboard. You can approve them again later.',
              disable: 'They will be signed out and blocked from signing in until you re-enable them.',
              enable: 'They will be able to sign in again immediately.',
              delete: 'This permanently deletes the account and profile. This cannot be undone.',
            };
            const isDestructive = kind === 'delete' || kind === 'disable' || kind === 'reject';
            const actionLabel = {
              reject: 'Reject', disable: 'Disable', enable: 'Enable', delete: 'Delete',
            }[kind];
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{titles[kind]}</AlertDialogTitle>
                  <AlertDialogDescription>
                    <span className="font-medium text-foreground">{userLabel}</span>
                    <br />
                    {descriptions[kind]}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {kind === 'reject' && (
                  <div className="space-y-2 py-2">
                    <Label htmlFor="reject-reason">Reason (optional)</Label>
                    <Input
                      id="reject-reason"
                      value={reason}
                      onChange={(e) => setConfirmAction((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Shown to the user on their pending screen"
                    />
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busyId === user.user_id}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); runConfirmedAction(); }}
                    disabled={busyId === user.user_id}
                    className={isDestructive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : ''}
                  >
                    {actionLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
