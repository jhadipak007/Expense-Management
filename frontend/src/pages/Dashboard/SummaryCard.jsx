import { useCallback, useId } from 'react';
import { getSummary } from '../../api/reports.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import page from '../../styles/page.module.css';
import { formatMoney } from '../../utils/format.js';
import styles from './SummaryCard.module.css';

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
    <section className={page.card} aria-labelledby={headingId} aria-busy={loading}>
      <h2 id={headingId} className={page.heading}>{title}</h2>
      {loading && <p className={page.muted} role="status">Loading...</p>}
      {error && (
        <>
          <p className={page.error} role="alert">Could not load this summary.</p>
          <button className={page.secondary} type="button" onClick={reload}>Retry</button>
        </>
      )}
      {data?.currencies.length === 0 && (
        <p className={page.muted}>No expenses match these filters.</p>
      )}
      {data?.currencies.map((currency) => (
        <CurrencyTotal key={currency.currency} currency={currency} />
      ))}
    </section>
  );
}

/** One currency's total and its breakdown, with a bar per category sized by its share. */
function CurrencyTotal({ currency }) {
  return (
    <div className={styles.currency}>
      <p className={styles.total}>{formatMoney(currency.total, currency.currency)}</p>
      <ul className={styles.breakdown} aria-label={`${currency.currency} by category`}>
        {currency.categories.map((category) => (
          <li key={category.category_id}>
            <div className={styles.row}>
              <span>{category.name}</span>
              <span>{formatMoney(category.total, currency.currency)}</span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <div
                className={styles.bar}
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
