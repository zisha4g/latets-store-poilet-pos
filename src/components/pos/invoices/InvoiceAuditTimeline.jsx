import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Skeleton } from '@/components/ui/Skeleton';

const formatTimestamp = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); }
  catch { return ''; }
};

const ACTION_LABEL = {
  created: 'Invoice created',
  updated: 'Updated',
  deleted: 'Deleted',
};

const labelFor = (action) => {
  if (!action) return 'Changed';
  if (action.startsWith('status:')) return `Status → ${action.slice(7)}`;
  return ACTION_LABEL[action] || action;
};

export const InvoiceAuditTimeline = ({ invoiceId }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) { setEntries([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('invoice_audit_log')
        .select('id, action, created_at, actor_id')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (!error) setEntries(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }
  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        No history yet.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-3 text-sm">
          <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="flex-1">
            <div className="font-medium">{labelFor(e.action)}</div>
            <div className="text-xs text-muted-foreground">{formatTimestamp(e.created_at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default InvoiceAuditTimeline;
