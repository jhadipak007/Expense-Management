import { cn } from 'cn';
import { Badge } from '@/components/ui/badge';
import { formatIsoDate, formatAmount } from '@/utils/format.js';

export const ACTION_LABELS = { created: 'Created', updated: 'Updated', deleted: 'Deleted', restored: 'Restored' };

const ACTION_STYLES = {
  created: 'border-transparent bg-primary/10 text-foreground',
  updated: 'border-transparent bg-accent/25 text-foreground',
  deleted: 'border-destructive bg-transparent text-destructive',
  restored: 'border-success bg-transparent text-foreground',
};

const FIELD_LABELS = {
  amount: 'Amount', currency: 'Currency', category: 'Category', spent_on: 'Date', description: 'Description',
};

/** What happened to a transaction, as a badge; the label carries the meaning, not the colour. */
export function ActionBadge({ action }) {
  return <Badge className={cn('text-sm font-semibold', ACTION_STYLES[action])}>{ACTION_LABELS[action]}</Badge>;
}

/** A red "Deleted" badge for a transaction that is deleted now. */
export function DeletedBadge() {
  return <Badge className={ACTION_STYLES.deleted}>Deleted</Badge>;
}

function show(field, value) {
  if (value === null || value === '') return 'None';
  if (field === 'amount') return formatAmount(value);
  if (field === 'spent_on') return formatIsoDate(value);
  return value;
}

/** An update's changed fields, one per line: "Amount: 12.50 → 15.00". */
export function AuditChanges({ changes }) {
  if (!changes) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-sm wrap-anywhere">
      {Object.entries(changes).map(([field, [before, after]]) => (
        <li key={field}>
          <span className="font-semibold text-foreground">{FIELD_LABELS[field] ?? field}:</span>{' '}
          {show(field, before)} <span aria-hidden="true">→</span><span className="sr-only">changed to</span> {show(field, after)}
        </li>
      ))}
    </ul>
  );
}
