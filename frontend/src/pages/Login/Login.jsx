import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import styles from '../../components/AuthForm/AuthForm.module.css';
import Field from '../../components/AuthForm/Field.jsx';
import SubmitButton from '../../components/AuthForm/SubmitButton.jsx';
import { LockIcon, MailIcon } from '../../components/AuthForm/icons.jsx';
import AuthLayout from '../../components/AuthLayout/AuthLayout.jsx';

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
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Log in to keep track of your expenses.</p>

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <Field
          id="email" label="Email" type="email" autoComplete="email" placeholder="you@example.com"
          icon={<MailIcon />} value={email} onChange={setEmail} error={errors.email}
        />
        <Field
          id="password" label="Password" autoComplete="current-password" placeholder="Your password"
          icon={<LockIcon />} revealable value={password} onChange={setPassword} error={errors.password}
        />
        <div className={styles.forgotRow}>
          <button type="button" className={styles.linkButton} onClick={() => setResetAsked(true)}>
            Forgot password?
          </button>
        </div>
        {resetAsked && (
          <p className={styles.status} role="status">
            {RESET_COMING_SOON}
          </p>
        )}

        <SubmitButton pending={submitting} pendingLabel="Logging in...">Log in</SubmitButton>

        <p className={styles.switch}>
          New to Expense Sarathi? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
