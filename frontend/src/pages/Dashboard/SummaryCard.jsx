import { useCallback, useId } from 'react';
import { Link } from 'react-router';
import { PlusIcon, ReceiptTextIcon, UserIcon, UsersIcon } from 'lucide-react';
import { getSummary } from '@/api/reports.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import EmptyState from '@/components/EmptyState.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardIntro } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/utils/format.js';
import CategoryChart from './CategoryChart.jsx';

/**
 * Spending for one scope (personal when `familyId` is null) under the dashboard
 * filters. Loads on its own, so one failing card does not affect the others.
 * `addExpense` is the Add expense link target offered when nothing matches.
 */
export default function SummaryCard({ title, familyId, filters, addExpense }) {
  const { from, to, categoryIds } = filters;
  const load = useCallback(
    (signal) => getSummary({ familyId, from, to, categoryIds }, signal),
    [familyId, from, to, categoryIds],
  );
  const { data, error, loading, reload } = useAsyncList(load);
  const headingId = useId();
  const personal = familyId === null;

  return (
    <SectionCard aria-labelledby={headingId} aria-busy={loading}>
      <CardIntro
        id={headingId} title={title}
        description={personal ? 'Only you can see these' : 'Shared with your family'}
        icon={personal ? UserIcon : UsersIcon} iconClassName={personal ? undefined : 'bg-accent/25 text-foreground'}
      />
      {loading && <p className="sr-only" role="status">Loading...</p>}
      {loading && !data && !error && <SummarySkeleton />}
      {error && (
        <>
          <Notice>Could not load this summary.</Notice>
          <Button variant="outline" className="self-start" onClick={reload}>Retry</Button>
        </>
      )}
      {data?.currencies.length === 0 && (
        <EmptyState
          icon={ReceiptTextIcon} title="No expenses match these filters"
          description="Try another period or category."
        >
          <Button asChild variant="outline">
            <Link to={addExpense}><PlusIcon />Add an expense</Link>
          </Button>
        </EmptyState>
      )}
      {data?.currencies.length > 0 && (
        <div className="flex flex-col divide-y">
          {data.currencies.map((currency) => (
            <div key={currency.currency} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <p className="text-3xl font-bold wrap-anywhere text-foreground">
                {formatMoney(currency.total, currency.currency)}
              </p>
              <CategoryChart currency={currency} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/** Placeholder shaped like a total and its category bars. */
function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}
