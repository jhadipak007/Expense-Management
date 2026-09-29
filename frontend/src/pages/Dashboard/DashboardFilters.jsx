import { useState } from 'react';
import FormField from '@/components/FormField.jsx';
import OptionGroup, { Option } from '@/components/OptionGroup.jsx';
import SectionCard from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    <SectionCard className="gap-3" aria-label="Filters">
      <OptionGroup legend="Period">
        <RadioGroup value={period} onValueChange={choosePeriod} className="flex flex-wrap gap-x-4 gap-y-0">
          {[...PRESETS, { key: 'custom', label: 'Custom' }].map(({ key, label }) => (
            <Option key={key} label={label}>
              <RadioGroupItem value={key} />
            </Option>
          ))}
        </RadioGroup>
      </OptionGroup>
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
      <OptionGroup legend="Categories">
        <div className="flex flex-wrap gap-x-4">
          <Option label="All categories">
            <Checkbox
              checked={filters.categoryIds.length === 0}
              onCheckedChange={() => onChange({ ...filters, categoryIds: [] })}
            />
          </Option>
          {categories.map((category) => (
            <Option key={category.id} label={category.name}>
              <Checkbox
                checked={filters.categoryIds.includes(category.id)}
                onCheckedChange={() => toggleCategory(category.id)}
              />
            </Option>
          ))}
        </div>
      </OptionGroup>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{describeFilters(filters, categories)}</p>
        <Button variant="outline" onClick={reset}>Reset</Button>
      </div>
    </SectionCard>
  );
}
