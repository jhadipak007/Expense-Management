import { useState } from 'react';
import { LockIcon, MailIcon } from 'lucide-react';
import { register } from '@/api/auth.js';
import AuthCard from '@/components/AuthLayout/AuthCard.jsx';
import FormField from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNAVAILABLE = 'Something went wrong. Please try again.';
const SERVER_FIELD_ERRORS = {
  display_name: 'Name must be 1 to 100 characters',
  email: 'Enter a valid email address',
  password: 'Password must be 8 to 72 characters',
};

/** Browser-side checks that mirror the API rules; returns errors keyed by field. */
function validateDetails({ displayName, email, password, confirm }) {
  const errors = {};
  if (!displayName.trim()) errors.displayName = 'Name is required';
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (new TextEncoder().encode(password).length > 72) errors.password = 'Password is too long';
  if (!confirm) errors.confirm = 'Please confirm your password';
  else if (password && confirm !== password) errors.confirm = 'Passwords do not match';
  return errors;
}

function serverFieldErrors(body) {
  const errors = {};
  for (const { loc } of body?.detail ?? []) {
    const field = loc?.[1];
    if (SERVER_FIELD_ERRORS[field]) {
      errors[field === 'display_name' ? 'displayName' : field] = SERVER_FIELD_ERRORS[field];
    }
  }
  return errors;
}

export default function DetailsForm({ details, onChange, notice, onRegistered, loginLink }) {
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (field) => (value) => onChange({ ...details, [field]: value });

  async function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = validateDetails(details);
    setErrors(fieldErrors);
    setFormError(null);
    if (Object.keys(fieldErrors).length) return;
    setSubmitting(true);
    try {
      onRegistered(await register(details.displayName.trim(), details.email.trim(), details.password));
    } catch (error) {
      if (error.status === 409) {
        setFormError(<>An account with this email already exists. {loginLink} instead.</>);
      } else if (error.status === 422) {
        setErrors(serverFieldErrors(error.body));
      } else {
        setFormError(UNAVAILABLE);
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Start tracking your expenses in minutes." onSubmit={handleSubmit}>
      {(formError || notice) && <Notice>{formError || notice}</Notice>}

      <FormField
        id="displayName" label="Name" autoComplete="name" maxLength={100} placeholder="Your name"
        value={details.displayName} onChange={set('displayName')} error={errors.displayName}
      />
      <FormField
        id="email" label="Email" type="email" autoComplete="email"
        placeholder="you@example.com" icon={<MailIcon />}
        value={details.email} onChange={set('email')} error={errors.email}
      />
      <FormField
        id="password" label="Password" autoComplete="new-password" icon={<LockIcon />} revealable
        placeholder="At least 8 characters" value={details.password} onChange={set('password')} error={errors.password}
      />
      <FormField
        id="confirm" label="Confirm password" autoComplete="new-password" icon={<LockIcon />} revealable
        placeholder="Repeat your password" value={details.confirm} onChange={set('confirm')} error={errors.confirm}
      />

      <SubmitButton pending={submitting} pendingLabel="Signing up...">Sign up</SubmitButton>

      <p className="text-center">Already have an account? {loginLink}</p>
    </AuthCard>
  );
}
