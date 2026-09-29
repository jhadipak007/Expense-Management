import { useState } from 'react';
import FormField, { SelectField } from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { NativeSelectOption } from '@/components/ui/native-select';
import { todayIso } from '@/utils/format.js';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const UNAVAILABLE = 'Something went wrong. Please try again.';
const CHECK_FORM = 'Please check the form and try again.';
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
  const amount = form.amount.trim();
  if (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) errors.amount = MESSAGES.amount;
  if (form.spent_on > todayIso()) errors.spent_on = MESSAGES.spent_on;
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

function toPayload(form) {
  return {
    amount: form.amount.trim(),
    currency: form.currency,
    category_id: Number(form.category_id),
    spent_on: form.spent_on,
    description: form.description.trim() || null,
    family_id: form.family_id ? Number(form.family_id) : null,
  };
}

/**
 * Amount, currency, category, date, description and who to share with.
 * Categories, currencies and families come from the server.
 * `onSubmit(payload)` saves it; if it throws, the error is shown and the input kept.
 */
export default function ExpenseForm({ categories, currencies, families, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, spent_on: todayIso() }));
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
      await onSubmit(toPayload(form));
    } catch (error) {
      if (error.status === 422) showServerErrors(serverFieldErrors(error.body));
      else if (error.status === 404) setFormError(`${error.body.detail}. ${MESSAGES.family_id}.`);
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
        <SelectField
          id="share-with" label="Share with" value={form.family_id} onChange={set('family_id')}
          hint="Personal expenses are only yours. A family's members all see its expenses."
          error={errors.family_id}
        >
          <NativeSelectOption value="">Personal</NativeSelectOption>
          {families.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
        </SelectField>
      </FormSection>
      <SubmitButton pending={submitting} pendingLabel="Saving..." disabled={!complete} className="md:w-auto md:self-end md:px-10">
        Save
      </SubmitButton>
    </form>
  );
}

/** A titled group of related fields, separated from the next by a rule. */
function FormSection({ legend, children }) {
  return (
    <FieldSet className="gap-4 border-b pb-6">
      <FieldLegend className="mb-0 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {legend}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}
