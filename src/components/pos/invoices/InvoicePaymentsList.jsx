import React from 'react';
import { Trash2, Banknote, CreditCard, Building2, FileText, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';

const METHOD_ICONS = {
  cash: Banknote,
  card: CreditCard,
  bank: Building2,
  check: FileText,
  other: Coins,
};

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); }
  catch { return '—'; }
};

export const InvoicePaymentsList = ({ payments = [], currency = 'USD', onDelete, canDelete }) => {
  if (!payments.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        No payments recorded.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-md border bg-card">
      {payments.map((p) => {
        const Icon = METHOD_ICONS[p.method] || Coins;
        return (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium tabular-nums">{formatMoney(p.amount, currency)}</span>
                <span className="text-xs text-muted-foreground">{formatDate(p.paid_at)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="capitalize">{p.method}</span>
                {p.reference ? <> · {p.reference}</> : null}
                {p.notes ? <> · {p.notes}</> : null}
              </div>
            </div>
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete payment"
                onClick={() => onDelete?.(p.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default InvoicePaymentsList;
