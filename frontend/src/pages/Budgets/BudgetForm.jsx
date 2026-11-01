import { useState } from 'react';
import FormField, { SelectField } from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import { NativeSelectOption } from '@/components/ui/native-select';
import { AMOUNT_PATTERN, FormSection } from '@/pages/Expenses/ExpenseForm.jsx';
import { PERIODS } from './budgetLabels.js';

const ALL = 'all';
const UNAVAILABLE = 'Something went wrong. Please try again.';
const CHECK_FORM = 'Please check the form and try again.';
const MESSAGES = {
  family_id: 'Choose Personal or a family you own',
  category_id: 'Choose a category, or All categories',
  period: 'Choose a period',
  amount: 'Enter an amount greater than 0, with at most 2 decimal places',
  currency: 'Choose a currency from the list',
};

/** Form values from a budget being edited, or the defaults for a new one. */
function initialForm(budget) {
  if (!budget) return { family_id: '', category_id: '', period: '', amount: '', currency: 'AUD' };
  return {
    family_id: String(budget.family_id ?? ''),
    category_id: budget.category_id === null ? ALL : String(budget.category_id),
    period: budget.period,
    amount: budget.amount,
    currency: budget.currency,
  };
}

/** Browser-side checks that mirror the API rules; returns errors keyed by field. */
function validate(form) {
  const errors = {};
  const amount = form.amount.trim();
  if (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) errors.amount = MESSAGES.amount;
  for (const field of ['category_id', 'period', 'currency']) {
    if (!form[field]) errors[field] = MESSAGES[field];
  }
  return errors;
}

function serverFieldErrors(body) {
  const errors = {};
  for (const { loc } of body?.detail ?? []) {
    const field = loc?.[1];
    if (MESSAGES[field]) errors[field] = MESSAGES[field];
  }
  return errors;
}

function toPayload(form, editing) {
  const changes = { amount: form.amount.trim(), period: form.period };
  if (editing) return changes;
  return {
    ...changes,
    family_id: form.family_id ? Number(form.family_id) : null,
    category_id: form.category_id === ALL ? null : Number(form.category_id),
    currency: form.currency,
  };
}

/**
 * Who the budget applies to, its category, period, amount and currency.
 * With `budget`, it edits that budget: only the amount and period can change.
 * Only families the user owns are offered. `onSubmit(payload)` saves it; if it
 * throws, the error is shown and the input kept.
 */
export default function BudgetForm({ categories, currencies, families, budget, onSubmit }) {
  const editing = Boolean(budget);
  const [form, setForm] = useState(() => initialForm(budget));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const owned = families.filter((f) => f.role === 'owner' || f.id === budget?.family_id);

  async function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    setFormError('');
    if (Object.keys(fieldErrors).length) return;
    setSubmitting(true);
    try {
      await onSubmit(toPayload(form, editing));
    } catch (error) {
      if (error.status === 422) {
        const serverErrors = serverFieldErrors(error.body);
        setErrors(serverErrors);
        if (!Object.keys(serverErrors).length) setFormError(CHECK_FORM);
      } else if ([403, 404, 409].includes(error.status)) setFormError(`${error.body.detail}.`);
      else setFormError(UNAVAILABLE);
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {formError && <Notice>{formError}</Notice>}
      <FormSection legend="What it covers">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            id="applies-to" label="Applies to" value={form.family_id} onChange={set('family_id')}
            hint={editing ? undefined : 'Family budgets can be set by the family owner.'}
            error={errors.family_id} disabled={editing}
          >
            <NativeSelectOption value="">Personal</NativeSelectOption>
            {owned.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
          </SelectField>
          <SelectField
            id="budget-category" label="Category" value={form.category_id} onChange={set('category_id')}
            error={errors.category_id} disabled={editing}
          >
            <NativeSelectOption value="" disabled>Choose a category</NativeSelectOption>
            <NativeSelectOption value={ALL}>All categories</NativeSelectOption>
            {categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
          </SelectField>
          <SelectField
            id="period" label="Period" value={form.period} onChange={set('period')} error={errors.period}
          >
            <NativeSelectOption value="" disabled>Choose a period</NativeSelectOption>
            {PERIODS.map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
          </SelectField>
        </div>
      </FormSection>
      <FormSection legend="Limit">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="amount" label="Amount" inputMode="decimal" autoComplete="off" placeholder="0.00"
            hint="Limit for each period" value={form.amount} onChange={set('amount')} error={errors.amount}
          />
          <SelectField
            id="currency" label="Currency" value={form.currency} onChange={set('currency')}
            error={errors.currency} disabled={editing}
          >
            {currencies.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>{`${c.code} - ${c.name}`}</NativeSelectOption>
            ))}
          </SelectField>
        </div>
      </FormSection>
      <SubmitButton pending={submitting} pendingLabel="Saving..." className="md:w-auto md:self-end md:px-10">
        Save budget
      </SubmitButton>
    </form>
  );
}
