import { Link } from 'react-router';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import ConfirmButton from '@/components/ConfirmButton.jsx';
import { ItemActions } from '@/components/ItemRow.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney, formatPeriod } from '@/utils/format.js';
import { PERIOD_LABELS, STATUSES } from '@/pages/Budgets/budgetLabels.js';

/**
 * One budget in its current period: status, dates, a progress bar, spent and what is left.
 * Edit and Delete are offered only when the user can manage it.
 */
export default function BudgetItem({ budget, name, editLink, busy, onDelete }) {
  const status = STATUSES[budget.status];
  const title = `${name} · ${PERIOD_LABELS[budget.period]}`;
  const money = (amount) => formatMoney(amount, budget.currency);

  return (
    <li className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 wrap-anywhere">
          <span className="font-semibold text-foreground">{title}</span>
          <span className="text-sm">{formatPeriod(budget.period_start, budget.period_end)}</span>
        </div>
        <Badge className={status.badge}>{status.label}</Badge>
      </div>
      <BudgetProgress budget={budget} label={`${title} spent`} barClass={status.bar} />
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="font-semibold text-foreground">{money(budget.spent)}</span>
          {` spent of ${money(budget.amount)}`}
        </span>
        {budget.status === 'over' ? (
          <span className="font-semibold text-destructive">{`Over by ${money(budget.over_by)}`}</span>
        ) : (
          <span>{`${money(budget.remaining)} left`}</span>
        )}
      </div>
      {budget.can_manage && (
        <ItemActions>
          <Button asChild variant="outline">
            <Link to={editLink} aria-label={`Edit ${title} budget`}><PencilIcon />Edit</Link>
          </Button>
          <ConfirmButton
            variant="outline" disabled={busy} aria-label={`Delete ${title} budget`}
            title={`Delete the ${title} budget?`}
            description="Your expenses are not affected. You can create the budget again later."
            confirmLabel="Delete budget" cancelLabel="Keep budget" onConfirm={onDelete}
          >
            <Trash2Icon />Delete
          </ConfirmButton>
        </ItemActions>
      )}
    </li>
  );
}

/** Share of the budget spent, capped at a full bar; the width is set through the DOM style property. */
function BudgetProgress({ budget, label, barClass }) {
  const percent = Math.min(100, Math.round((Number(budget.spent) / Number(budget.amount)) * 100));
  return (
    <div
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
