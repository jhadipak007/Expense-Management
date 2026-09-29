import { useState } from 'react';
import FormField from '@/components/FormField.jsx';
import page from '../../styles/page.module.css';
import { describeFilters, matchingPreset, presetRange, PRESETS } from './dashboardFilters.js';
import styles from './DashboardFilters.module.css';

const RANGE_ERROR = 'The From date must be on or before the To date.';

/**
 * Period (a preset or a custom From-To range) and categories for every card.
 * A custom range is applied once both dates are set and in order.
 */
export default function DashboardFilters({ filters, categories, onChange, onReset }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState({ from: filters.from, to: filters.to });
  const [rangeError, setRangeError] = useState('');
  const [appliedRange, setAppliedRange] = useState(`${filters.from}/${filters.to}`);
  const period = customOpen ? 'custom' : matchingPreset(filters);

  // The URL can change without these controls (Reset, a link to the dashboard):
  // show what is applied then, not an earlier edit.
  if (appliedRange !== `${filters.from}/${filters.to}`) {
    setAppliedRange(`${filters.from}/${filters.to}`);
    setDraft({ from: filters.from, to: filters.to });
    setCustomOpen(false);
    setRangeError('');
  }

  function choosePeriod(key) {
    setRangeError('');
    if (key === 'custom') {
      setDraft({ from: filters.from, to: filters.to });
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onChange({ ...filters, ...presetRange(key) });
  }

  function changeDate(field, value) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (!next.from || !next.to) return;
    if (next.from > next.to) {
      setRangeError(RANGE_ERROR);
      return;
    }
    setRangeError('');
    onChange({ ...filters, ...next });
  }

  function toggleCategory(id) {
    const { categoryIds } = filters;
    const next = categoryIds.includes(id)
      ? categoryIds.filter((other) => other !== id)
      : [...categoryIds, id];
    onChange({ ...filters, categoryIds: next });
  }

  function reset() {
    setCustomOpen(false);
    setRangeError('');
    onReset();
  }

  return (
    <section className={`${page.card} ${styles.filters}`} aria-label="Filters">
      <fieldset className={page.options}>
        <legend>Period</legend>
        {[...PRESETS, { key: 'custom', label: 'Custom' }].map(({ key, label }) => (
          <label key={key}>
            <input
              type="radio" name="period" value={key}
              checked={period === key} onChange={() => choosePeriod(key)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {period === 'custom' && (
        <div className={styles.range}>
          <FormField
            id="filter-from" label="From" type="date" value={draft.from}
            onChange={(value) => changeDate('from', value)} error={rangeError}
          />
          <FormField
            id="filter-to" label="To" type="date" value={draft.to}
            onChange={(value) => changeDate('to', value)}
          />
        </div>
      )}
      <fieldset className={page.options}>
        <legend>Categories</legend>
        <label>
          <input
            type="checkbox" checked={filters.categoryIds.length === 0}
            onChange={() => onChange({ ...filters, categoryIds: [] })}
          />
          All categories
        </label>
        {categories.map((category) => (
          <label key={category.id}>
            <input
              type="checkbox" checked={filters.categoryIds.includes(category.id)}
              onChange={() => toggleCategory(category.id)}
            />
            {category.name}
          </label>
        ))}
      </fieldset>
      <div className={styles.footer}>
        <p className={page.muted}>{describeFilters(filters, categories)}</p>
        <button className={page.secondary} type="button" onClick={reset}>Reset</button>
      </div>
    </section>
  );
}
