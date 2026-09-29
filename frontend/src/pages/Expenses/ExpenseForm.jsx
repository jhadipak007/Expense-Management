import { useState } from 'react';
import FormField, { FieldError, FieldLabel } from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import { NativeSelect, NativeSelectOption as Option } from '@/components/ui/native-select';
import { todayIso } from '../../utils/format.js';

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
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      {formError && <Notice>{formError}</Notice>}
      <FormField
        id="amount" label="Amount" inputMode="decimal" autoComplete="off" placeholder="0.00"
        value={form.amount} onChange={set('amount')} error={errors.amount}
      />
      <SelectField
        id="currency" label="Currency" value={form.currency} onChange={set('currency')}
        error={errors.currency}
        options={currencies.map((c) => (
          <Option key={c.code} value={c.code}>{`${c.code} - ${c.name}`}</Option>
        ))}
      />
      <SelectField
        id="category" label="Category" value={form.category_id} onChange={set('category_id')}
        error={errors.category_id}
        options={[
          <Option key="" value="" disabled>Choose a category</Option>,
          ...categories.map((c) => <Option key={c.id} value={c.id}>{c.name}</Option>),
        ]}
      />
      <FormField
        id="spent-on" label="Date" type="date" max={todayIso()}
        value={form.spent_on} onChange={set('spent_on')} error={errors.spent_on}
      />
      <FormField
        id="description" label="Description (optional)" maxLength={500}
        value={form.description} onChange={set('description')} error={errors.description}
      />
      <SelectField
        id="share-with" label="Share with" value={form.family_id} onChange={set('family_id')}
        error={errors.family_id}
        options={[
          <Option key="" value="">Personal</Option>,
          ...families.map((f) => <Option key={f.id} value={f.id}>{f.name}</Option>),
        ]}
      />
      <SubmitButton pending={submitting} pendingLabel="Saving..." disabled={!complete}>
        Save
      </SubmitButton>
    </form>
  );
}

/** Labelled native select whose error is linked with aria-describedby, like `FormField`. */
function SelectField({ id, label, options, value, onChange, error }) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id} className="bg-card text-foreground" value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
      >
        {options}
      </NativeSelect>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
