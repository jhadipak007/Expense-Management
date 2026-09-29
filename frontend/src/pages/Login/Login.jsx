import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LockIcon, MailIcon } from 'lucide-react';
import { useAuth } from '@/auth/useAuth.js';
import AuthCard from '@/components/AuthLayout/AuthCard.jsx';
import AuthLayout from '@/components/AuthLayout/AuthLayout.jsx';
import FormField from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import TextLink from '@/components/TextLink.jsx';
import { Button } from '@/components/ui/button';

const INCORRECT = 'Incorrect email or password';
const UNAVAILABLE = 'Something went wrong. Please try again.';
const RESET_COMING_SOON = 'Password reset is coming soon.';

function requiredErrors(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [resetAsked, setResetAsked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const fieldErrors = requiredErrors(email, password);
    setErrors(fieldErrors);
    setFormError('');
    if (Object.keys(fieldErrors).length) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (error) {
      setFormError(error.status === 401 ? INCORRECT : UNAVAILABLE);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard title="Welcome back" subtitle="Log in to keep track of your expenses." onSubmit={handleSubmit}>
        {formError && <Notice>{formError}</Notice>}

        <FormField
          id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com"
          icon={<MailIcon />} value={email} onChange={setEmail} error={errors.email}
        />
        <FormField
          id="password" label="Password" autoComplete="current-password" placeholder="Your password"
          icon={<LockIcon />} revealable value={password} onChange={setPassword} error={errors.password}
        />
        <div className="-mt-2 flex justify-end">
          <Button type="button" variant="link" className="px-1 text-sm" onClick={() => setResetAsked(true)}>
            Forgot password?
          </Button>
        </div>
        {resetAsked && (
          <p className="text-sm" role="status">
            {RESET_COMING_SOON}
          </p>
        )}

        <SubmitButton pending={submitting} pendingLabel="Logging in...">Log in</SubmitButton>

        <p className="text-center">
          New to Expense Sarathi? <TextLink to="/register">Create an account</TextLink>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
