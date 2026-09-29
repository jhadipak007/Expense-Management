import { useCallback, useId } from 'react';
import { getSummary } from '@/api/reports.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/utils/format.js';

/**
 * Spending for one scope (personal when `familyId` is null) under the dashboard
 * filters. Loads on its own, so one failing card does not affect the others.
 */
export default function SummaryCard({ title, familyId, filters }) {
  const { from, to, categoryIds } = filters;
  const load = useCallback(
    (signal) => getSummary({ familyId, from, to, categoryIds }, signal),
    [familyId, from, to, categoryIds],
  );
  const { data, error, loading, reload } = useAsyncList(load);
  const headingId = useId();

  return (
    <SectionCard aria-labelledby={headingId} aria-busy={loading}>
      <CardHeading id={headingId}>{title}</CardHeading>
      {loading && <p className="text-sm" role="status">Loading...</p>}
      {error && (
        <>
          <Notice>Could not load this summary.</Notice>
          <Button variant="outline" className="self-start" onClick={reload}>Retry</Button>
        </>
      )}
      {data?.currencies.length === 0 && (
        <p className="text-sm">No expenses match these filters.</p>
      )}
      {data?.currencies.map((currency) => (
        <CurrencyTotal key={currency.currency} currency={currency} />
      ))}
    </SectionCard>
  );
}

/** One currency's total and its breakdown, with a bar per category sized by its share. */
function CurrencyTotal({ currency }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xl font-bold wrap-anywhere text-foreground">{formatMoney(currency.total, currency.currency)}</p>
      <ul className="flex flex-col gap-2" aria-label={`${currency.currency} by category`}>
        {currency.categories.map((category) => (
          <li key={category.category_id}>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{category.name}</span>
              <span>{formatMoney(category.total, currency.currency)}</span>
            </div>
            <div className="h-2 rounded-md bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-md"
                style={{
                  width: `${(100 * category.total) / currency.total}%`,
                  background: category.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
