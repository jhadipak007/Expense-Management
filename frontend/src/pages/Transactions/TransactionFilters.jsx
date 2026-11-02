import { useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import CategoryChips from '@/components/CategoryChips.jsx';
import FormField, { SelectField } from '@/components/FormField.jsx';
import { Button } from '@/components/ui/button';
import { NativeSelectOption } from '@/components/ui/native-select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ACTION_LABELS } from './auditDisplay.jsx';
import { ACTIONS, hasActiveFilters } from './transactionFilters.js';

const RANGE_ERROR = 'The From date must be on or before the To date.';

const draftKey = ({ from, to, q }) => `${from}/${to}/${q}`;

/**
 * Filters for both views: expense dates, categories, member (families only), description
 * search and, in the audit log, actions. `onChange(change)` applies a partial change;
 * `onClear` clears them all. Search applies on submit; dates once they are in order.
 */
export default function TransactionFilters({ filters, categories, members, onChange, onClear }) {
  const [draft, setDraft] = useState({ from: filters.from, to: filters.to, q: filters.q });
  const [applied, setApplied] = useState(draftKey(filters));
  const [rangeError, setRangeError] = useState('');
  const audit = filters.view === 'audit';

  // The dates or search can change without these fields (Clear all, Back): show what is applied
  // then. Other filter changes keep a search still being typed.
  if (applied !== draftKey(filters)) {
    setApplied(draftKey(filters));
    setDraft({ from: filters.from, to: filters.to, q: filters.q });
    setRangeError('');
  }

  function changeDate(field, value) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (next.from && next.to && next.from > next.to) {
      setRangeError(RANGE_ERROR);
      return;
    }
    setRangeError('');
    onChange({ from: next.from, to: next.to });
  }

  function search(event) {
    event.preventDefault();
    onChange({ q: draft.q.trim() });
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Filters">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <FormField
          id="filter-from" label="Spent from" type="date" value={draft.from}
          onChange={(value) => changeDate('from', value)} error={rangeError}
        />
        <FormField
          id="filter-to" label="Spent to" type="date" value={draft.to}
          onChange={(value) => changeDate('to', value)}
        />
        {filters.space && (
          <SelectField
            id="filter-member" label={audit ? 'Performed by' : 'Created by'} value={filters.member ?? ''}
            onChange={(value) => onChange({ member: value ? Number(value) : null })}
          >
            <NativeSelectOption value="">Any member</NativeSelectOption>
            {members.map((m) => (
              <NativeSelectOption key={m.user_id} value={m.user_id}>{m.display_name}</NativeSelectOption>
            ))}
          </SelectField>
        )}
        <form role="search" onSubmit={search} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <FormField
              id="filter-q" label="Search descriptions" type="search" maxLength={100} value={draft.q}
              onChange={(value) => setDraft((current) => ({ ...current, q: value }))}
            />
          </div>
          <Button type="submit" variant="outline" size="icon" className="size-11" aria-label="Search">
            <SearchIcon />
          </Button>
        </form>
      </div>
      <CategoryChips
        categories={categories} selected={filters.categoryIds}
        onChange={(categoryIds) => onChange({ categoryIds })}
      />
      {audit && (
        <ToggleGroup
          type="multiple" variant="outline" value={filters.actions} aria-label="Actions"
          onValueChange={(actions) => onChange({ actions })} className="flex flex-wrap gap-2"
        >
          {ACTIONS.map((action) => (
            <ToggleGroupItem key={action} value={action} className="rounded-full! border! data-[state=on]:border-primary!">
              {ACTION_LABELS[action]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {hasActiveFilters(filters) && (
        <Button variant="ghost" className="self-start text-foreground" onClick={onClear}>
          <XIcon />Clear all filters
        </Button>
      )}
    </section>
  );
}
