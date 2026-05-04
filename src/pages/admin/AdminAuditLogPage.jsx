import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, ScrollText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AdminAuditLogPage = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('voice_admin_audit_logs')
      .select('id, admin_user_id, target_user_id, action, old_value, new_value, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: 'Failed to load audit log', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Recent admin actions across the platform.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 && !loading ? (
            <div className="py-16 flex flex-col items-center text-center gap-2">
              <ScrollText className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No audit entries yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">When</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{r.action}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.admin_user_id?.slice(0, 8)}…</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.target_user_id?.slice(0, 8) ?? '—'}{r.target_user_id ? '…' : ''}</td>
                      <td className="px-4 py-2 text-xs">
                        <code className="text-muted-foreground">
                          {JSON.stringify(r.new_value ?? r.old_value ?? {}).slice(0, 80)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuditLogPage;
