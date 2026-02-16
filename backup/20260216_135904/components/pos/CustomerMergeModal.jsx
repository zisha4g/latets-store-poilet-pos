import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { groupDuplicateCustomers, mergeCustomers } from '@/lib/customerMerge';
import { toast } from '@/components/ui/use-toast';

const CustomerMergeModal = ({ isOpen, onClose, customers, onMerged }) => {
  const groups = useMemo(() => groupDuplicateCustomers(customers), [customers]);
  const [busy, setBusy] = useState(false);
  // Locally hide customers that have been merged/removed so UI reflects progress immediately
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  const displayGroups = useMemo(() => {
    if (!groups?.length) return [];
    const filtered = groups
      .map(g => ({
        ...g,
        customers: g.customers.filter(c => !hiddenIds.has(c.id))
      }))
      .filter(g => g.customers.length > 1);
    return filtered;
  }, [groups, hiddenIds]);

  const handleMerge = async (group, keepId, removeId) => {
    try {
      setBusy(true);
      await mergeCustomers({ primaryId: keepId, duplicateId: removeId, strategy: 'fill-missing' });
      // Optimistically hide removed customer from current view
      setHiddenIds(prev => new Set(prev).add(removeId));
      toast({ title: 'Customers Merged' });
      onMerged?.();
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || '');
      // Treat duplicate-not-found as a soft success (most likely already merged/deleted)
      if (/duplicate customer not found/i.test(msg)) {
        setHiddenIds(prev => new Set(prev).add(removeId));
        toast({ title: 'Already merged or removed', description: 'We refreshed your list.', variant: 'default' });
        onMerged?.();
      } else {
        toast({ title: 'Merge Failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Duplicate Customers</DialogTitle>
          <DialogDescription>
            We detected duplicates by phone or email. Choose which record to keep; the other will be merged and removed.
          </DialogDescription>
        </DialogHeader>
        {displayGroups.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No duplicate groups found.</div>
        ) : (
          <div className="space-y-4">
            {displayGroups.map((g, idx) => (
              <div key={`${g.type}-${g.key}-${idx}`} className="border rounded-lg p-3">
                <div className="text-sm text-muted-foreground mb-2">
                  Match by {g.type}: <span className="font-mono">{g.key}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {g.customers.map((c) => (
                    <div key={c.id} className="p-3 rounded-lg bg-secondary">
                      <div className="font-semibold">{c.name || 'Unnamed'}</div>
                      <div className="text-sm text-muted-foreground">{c.phone || '—'} • {c.email || '—'}</div>
                      <div className="mt-2 flex gap-2">
                        {g.customers.filter(x => x.id !== c.id).map(other => (
                          <Button
                            key={other.id}
                            size="sm"
                            onClick={() => handleMerge(g, c.id, other.id)}
                            disabled={busy}
                          >
                            Keep this, merge {other.name || other.id.slice(0,6)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="pt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerMergeModal;
