import { useId, useState } from 'react';
import { SearchXIcon, UserIcon, UsersIcon } from 'lucide-react';
import { SelectField } from '@/components/FormField.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import SectionCard, { CardIntro } from '@/components/SectionCard.jsx';
import { NativeSelectOption } from '@/components/ui/native-select';
import { ALL, PERIODS, categoryName } from '@/pages/Budgets/budgetLabels.js';
import BudgetItem from './BudgetItem.jsx';

const ANY = '';

/** Budgets matching the chosen period and category; ALL keeps only all-category budgets. */
function matches(budget, period, category) {
  const categoryOk = category === ANY
    || (category === ALL ? budget.category_id === null : budget.category_id === Number(category));
  return (period === ANY || budget.period === period) && categoryOk;
}

/**
 * Budgets of one scope (Personal or a family), with their own period and category filters.
 * `editLink(budget)` is the edit page target; `onDelete(budget)` deletes after confirmation.
 */
export default function BudgetGroup({ title, personal, budgets, categories, editLink, busyId, onDelete }) {
  const [period, setPeriod] = useState(ANY);
  const [category, setCategory] = useState(ANY);
  const id = useId();
  const shown = budgets.filter((budget) => matches(budget, period, category));

  return (
    <SectionCard aria-label={`${title} budgets`}>
      <CardIntro
        as="h3" title={title}
        description={personal ? 'Only you can see these' : 'Shared with your family'}
        icon={personal ? UserIcon : UsersIcon} iconClassName={personal ? undefined : 'bg-accent/25 text-foreground'}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField id={`${id}-period`} label="Period" value={period} onChange={setPeriod}>
          <NativeSelectOption value={ANY}>All periods</NativeSelectOption>
          {PERIODS.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
        </SelectField>
        <SelectField id={`${id}-category`} label="Category" value={category} onChange={setCategory}>
          <NativeSelectOption value={ANY}>Any category</NativeSelectOption>
          <NativeSelectOption value={ALL}>All categories</NativeSelectOption>
          {categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
        </SelectField>
      </div>
      {shown.length === 0 && (
        <EmptyState icon={SearchXIcon} title="No budgets match" description="Try another period or category." />
      )}
      {shown.length > 0 && (
        <ul className="flex flex-col gap-3">
          {shown.map((budget) => (
            <BudgetItem
              key={budget.id} budget={budget} name={categoryName(budget, categories)}
              editLink={editLink(budget)} busy={busyId === budget.id} onDelete={() => onDelete(budget)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
