import { useState } from 'react';
import fieldStyles from '../../components/AuthForm/AuthForm.module.css';
import Field from '../../components/AuthForm/Field.jsx';
import SubmitButton from '../../components/AuthForm/SubmitButton.jsx';
import page from '../../styles/page.module.css';
import { todayIso } from '../../utils/format.js';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const UNAVAILABLE = 'Something went wrong. Please try again.';
const MESSAGES = {
  amount: 'Enter an amount greater than 0, with at most 2 decimal places',
  currency: 'Enter a 3-letter currency code, such as AUD',
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
  if (!/^[A-Z]{3}$/.test(form.currency)) errors.currency = MESSAGES.currency;
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
 * `onSubmit(payload)` saves it; if it throws, the error is shown and the input kept.
 */
export default function ExpenseForm({ categories, families, onSubmit }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, spent_on: todayIso() }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  const complete = form.amount.trim() && form.currency && form.category_id && form.spent_on;

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
      if (error.status === 422) setErrors(serverFieldErrors(error.body));
      else if (error.status === 404) setFormError(`${error.body.detail}. ${MESSAGES.family_id}.`);
      else setFormError(UNAVAILABLE);
      setSubmitting(false);
    }
  }

  return (
    <form className={page.form} onSubmit={handleSubmit} noValidate>
      {formError && <p className={page.error} role="alert">{formError}</p>}
      <Field
        id="amount" label="Amount" inputMode="decimal" autoComplete="off" placeholder="0.00"
        value={form.amount} onChange={set('amount')} error={errors.amount}
      />
      <Field
        id="currency" label="Currency" maxLength={3} autoComplete="off"
        value={form.currency} onChange={(value) => set('currency')(value.toUpperCase())}
        error={errors.currency}
      />
      <CategorySelect
        categories={categories} value={form.category_id} onChange={set('category_id')}
        error={errors.category_id}
      />
      <Field
        id="spent-on" label="Date" type="date" max={todayIso()}
        value={form.spent_on} onChange={set('spent_on')} error={errors.spent_on}
      />
      <Field
        id="description" label="Description (optional)" maxLength={500}
        value={form.description} onChange={set('description')} error={errors.description}
      />
      <ShareWith
        families={families} value={form.family_id} onChange={set('family_id')}
        error={errors.family_id}
      />
      <SubmitButton pending={submitting} pendingLabel="Saving..." disabled={!complete}>
        Save
      </SubmitButton>
    </form>
  );
}

function CategorySelect({ categories, value, onChange, error }) {
  return (
    <div className={fieldStyles.field}>
      <label htmlFor="category">Category</label>
      <select
        id="category" className={fieldStyles.input} value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? 'category-error' : undefined}
      >
        <option value="" disabled>Choose a category</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
      {error && <span id="category-error" className={fieldStyles.fieldError}>{error}</span>}
    </div>
  );
}

/** "Personal" or one of the user's families. */
function ShareWith({ families, value, onChange, error }) {
  const options = [{ id: '', name: 'Personal' }, ...families];
  return (
    <div className={fieldStyles.field}>
      <fieldset className={page.options} aria-describedby={error ? 'share-error' : undefined}>
        <legend>Share with</legend>
        {options.map((option) => (
          <label key={option.id}>
            <input
              type="radio" name="share-with" value={option.id}
              checked={value === String(option.id)} onChange={() => onChange(String(option.id))}
            />
            {option.name}
          </label>
        ))}
      </fieldset>
      {error && <span id="share-error" className={fieldStyles.fieldError}>{error}</span>}
    </div>
  );
}
