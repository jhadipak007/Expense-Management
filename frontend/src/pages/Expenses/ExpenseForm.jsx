import { useState } from 'react';
import FormField, { SelectField } from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import FormSection from '@/components/FormSection.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import { NativeSelectOption } from '@/components/ui/native-select';
import { todayIso } from '@/utils/format.js';
import { CHECK_FORM, UNAVAILABLE, isValidAmount, serverFieldErrors } from '@/utils/formErrors.js';

const MESSAGES = {
  amount: 'Enter an amount greater than 0, with at most 2 decimal places',
  currency: 'Choose a currency from the list',
  category_id: 'Choose a category',
  spent_on: 'Enter a date that is not in the future',
  description: 'Description must be at most 500 characters',
  family_id: 'Choose Personal or one of your families',
};

/** Form keys match the API fields, so server errors map straight onto them. */
const EMPTY = {
  amount: '', currency: 'AUD', category_id: '', spent_on: '', description: '', family_id: '',
};

/** Browser-side checks that mirror the API rules; returns errors keyed by field. */
function validate(form) {
  const errors = {};
  if (!isValidAmount(form.amount.trim())) errors.amount = MESSAGES.amount;
  if (form.spent_on > todayIso()) errors.spent_on = MESSAGES.spent_on;
  return errors;
}

/** Form values from a saved expense, for editing it. */
function fromExpense(expense) {
  return {
    amount: expense.amount,
    currency: expense.currency,
    category_id: String(expense.category.id),
    spent_on: expense.spent_on,
    description: expense.description ?? '',
    family_id: String(expense.family_id ?? ''),
  };
}

/** The API body; an edit leaves out `family_id`, since the space cannot change. */
function toPayload(form, editing) {
  const payload = {
    amount: form.amount.trim(),
    currency: form.currency,
    category_id: Number(form.category_id),
    spent_on: form.spent_on,
    description: form.description.trim() || null,
  };
  return editing ? payload : { ...payload, family_id: form.family_id ? Number(form.family_id) : null };
}

/**
 * Amount, currency, category, date, description and who to share with.
 * Categories, currencies and families come from the server. With `expense` the form
 * edits it: its values fill the form and who it is shared with is shown, not changed.
 * `onSubmit(payload)` saves it; if it throws, the error is shown and the input kept.
 */
export default function ExpenseForm({ categories, currencies, families, expense, onSubmit, children }) {
  const editing = Boolean(expense);
  const [form, setForm] = useState(() => (editing ? fromExpense(expense) : { ...EMPTY, spent_on: todayIso() }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const complete = form.amount.trim() && form.currency && form.category_id && form.spent_on;

  function showServerErrors(fieldErrors) {
    setErrors(fieldErrors);
    if (!Object.keys(fieldErrors).length) setFormError(CHECK_FORM);
  }

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
      if (error.status === 422) showServerErrors(serverFieldErrors(error.body, MESSAGES));
      else if (error.status === 404 && !editing) setFormError(`${error.body.detail}. ${MESSAGES.family_id}.`);
      else if ([403, 404, 409].includes(error.status)) setFormError(`${error.body.detail}.`);
      else setFormError(UNAVAILABLE);
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {formError && <Notice>{formError}</Notice>}
      <FormSection legend="How much">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="amount" label="Amount" inputMode="decimal" autoComplete="off" placeholder="0.00"
            hint="Up to 2 decimal places" value={form.amount} onChange={set('amount')} error={errors.amount}
          />
          <SelectField
            id="currency" label="Currency" value={form.currency} onChange={set('currency')}
            hint="Type a code to jump to it" error={errors.currency}
          >
            {currencies.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>{`${c.code} - ${c.name}`}</NativeSelectOption>
            ))}
          </SelectField>
        </div>
      </FormSection>
      <FormSection legend="What and when">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            id="category" label="Category" value={form.category_id} onChange={set('category_id')}
            error={errors.category_id}
          >
            <NativeSelectOption value="" disabled>Choose a category</NativeSelectOption>
            {categories.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>)}
          </SelectField>
          <FormField
            id="spent-on" label="Date" type="date" max={todayIso()}
            value={form.spent_on} onChange={set('spent_on')} error={errors.spent_on}
          />
        </div>
        <FormField
          id="description" label="Description (optional)" maxLength={500}
          value={form.description} onChange={set('description')} error={errors.description}
        />
      </FormSection>
      <FormSection legend="Who can see it">
        {editing ? (
          <p>
            Shared with{' '}
            <span className="font-semibold text-foreground">
              {families.find((f) => f.id === expense.family_id)?.name ?? 'Personal'}
            </span>
            . This cannot be changed.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              id="share-with" label="Share with" value={form.family_id} onChange={set('family_id')}
              hint="Personal expenses are only yours. A family's members all see its expenses."
              error={errors.family_id}
            >
              <NativeSelectOption value="">Personal</NativeSelectOption>
              {families.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
            </SelectField>
          </div>
        )}
      </FormSection>
      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        {children}
        <SubmitButton pending={submitting} pendingLabel="Saving..." disabled={!complete} className="md:w-auto md:px-10">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
