import { useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import CategoryChips from '@/components/CategoryChips.jsx';
import FormField from '@/components/FormField.jsx';
import { CardHeading } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { describeFilters, matchingPreset, presetRange, PRESETS } from './dashboardFilters.js';

const RANGE_ERROR = 'The From date must be on or before the To date.';

/**
 * Top of the Spending card: its heading (id `headingId`), the applied filters with Reset, then
 * the period (a preset or a custom From-To range) and categories for every summary.
 * A custom range is applied once both dates are set and in order. Month presets
 * start on `monthStartDay`.
 */
export default function DashboardFilters({ headingId, filters, categories, monthStartDay, onChange, onReset }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState({ from: filters.from, to: filters.to });
  const [rangeError, setRangeError] = useState('');
  const [appliedRange, setAppliedRange] = useState(`${filters.from}/${filters.to}`);
  const period = customOpen ? 'custom' : matchingPreset(filters, monthStartDay);

  // The URL can change without these controls (Reset, a link to the dashboard):
  // show what is applied then, not an earlier edit.
  if (appliedRange !== `${filters.from}/${filters.to}`) {
    setAppliedRange(`${filters.from}/${filters.to}`);
    setDraft({ from: filters.from, to: filters.to });
    setCustomOpen(false);
    setRangeError('');
  }

  function choosePeriod(key) {
    // Pressing the selected period again would clear it; keep it selected instead.
    if (!key) return;
    setRangeError('');
    if (key === 'custom') {
      setDraft({ from: filters.from, to: filters.to });
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onChange({ ...filters, ...presetRange(key, monthStartDay) });
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

  function reset() {
    setCustomOpen(false);
    setRangeError('');
    onReset();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardHeading id={headingId}>Spending</CardHeading>
          <p className="text-sm">{describeFilters(filters, categories)}</p>
        </div>
        <Button variant="ghost" className="text-foreground" onClick={reset}><RotateCcwIcon />Reset</Button>
      </div>
      <section className="flex flex-col gap-4" aria-label="Filters">
        <ToggleGroup
          type="single" value={period} onValueChange={choosePeriod} aria-label="Period"
          className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:inline-grid sm:w-fit sm:grid-cols-4"
        >
          {[...PRESETS, { key: 'custom', label: 'Custom' }].map(({ key, label }) => (
            <ToggleGroupItem
              key={key} value={key}
              className="rounded-md! text-muted-foreground data-[state=on]:bg-card data-[state=on]:shadow-sm"
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {period === 'custom' && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
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
        <CategoryChips
          categories={categories} selected={filters.categoryIds}
          onChange={(categoryIds) => onChange({ ...filters, categoryIds })}
        />
      </section>
    </>
  );
}
