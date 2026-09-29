import { useState } from 'react';
import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import FormField from '@/components/FormField.jsx';
import SectionCard from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { describeFilters, matchingPreset, presetRange, PRESETS } from './dashboardFilters.js';

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
    // Pressing the selected period again would clear it; keep it selected instead.
    if (!key) return;
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
    <SectionCard className="gap-4" aria-label="Filters">
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
        <Chip
          label="All categories" pressed={filters.categoryIds.length === 0}
          onPressedChange={() => onChange({ ...filters, categoryIds: [] })}
        />
        {categories.map((category) => (
          <Chip
            key={category.id} label={category.name} color={category.color}
            pressed={filters.categoryIds.includes(category.id)}
            onPressedChange={() => toggleCategory(category.id)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-sm">{describeFilters(filters, categories)}</p>
        <Button variant="ghost" className="text-foreground" onClick={reset}><RotateCcwIcon />Reset</Button>
      </div>
    </SectionCard>
  );
}

/** A pill that toggles one category filter; a check marks it on, a colour dot names the category's colour. */
function Chip({ label, color, pressed, onPressedChange }) {
  return (
    <Toggle
      variant="outline" pressed={pressed} onPressedChange={onPressedChange}
      className="rounded-full data-[state=on]:border-primary"
    >
      {pressed && <CheckIcon aria-hidden="true" />}
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />}
      {label}
    </Toggle>
  );
}
