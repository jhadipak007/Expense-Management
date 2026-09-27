import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import styles from '../../components/AuthForm/AuthForm.module.css';
import Field from '../../components/AuthForm/Field.jsx';

const INCORRECT = 'Incorrect email or password';
const UNAVAILABLE = 'Something went wrong. Please try again.';

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
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>Expense Sarathi</h1>
        <p className={styles.subtitle}>Log in to your account</p>

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <Field
          id="email" label="Email" type="email" autoComplete="email"
          value={email} onChange={setEmail} error={errors.email}
        />
        <Field
          id="password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={setPassword} error={errors.password}
        />

        <button className={`button ${styles.submit}`} type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>

        <p className={styles.switch}>
          New to Expense Sarathi? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
