import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  draft: 'bg-muted text-muted-foreground border-muted-foreground/20',
  sent: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  partial: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  overdue: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  void: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30 line-through',
};

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export const InvoiceStatusBadge = ({ status, className }) => {
  const key = (status || 'draft').toLowerCase();
  const style = STATUS_STYLES[key] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[key] || (status ? status[0].toUpperCase() + status.slice(1) : 'Draft');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        style,
        className,
      )}
    >
      {label}
    </span>
  );
};

export default InvoiceStatusBadge;
