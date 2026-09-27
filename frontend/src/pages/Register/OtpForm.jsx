import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import styles from '../../components/AuthForm/AuthForm.module.css';
import Field from '../../components/AuthForm/Field.jsx';

const INCORRECT = 'Incorrect code, please try again';
const UNAVAILABLE = 'Something went wrong. Please try again.';

/** OTP step. A 404 means the sign-up is gone (too many attempts or expired). */
export default function OtpForm({ registrationId, onBack, onRestart }) {
  const { completeRegistration } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const valid = /^\d{4}$/.test(code);
    setCodeError(valid ? '' : 'Enter the 4-digit code');
    setFormError('');
    if (!valid) return;
    setSubmitting(true);
    try {
      await completeRegistration(registrationId, code);
      navigate('/', { replace: true });
    } catch (error) {
      if (error.status === 404) return onRestart();
      setFormError(error.status === 400 ? INCORRECT : UNAVAILABLE);
      setCode('');
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <h1 className={styles.title}>Confirm your sign-up</h1>
      <p className={styles.subtitle}>Enter the 4-digit code to finish creating your account.</p>

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <Field
        id="code" label="Code" inputMode="numeric" autoComplete="one-time-code"
        value={code} onChange={setCode} error={codeError}
      />

      <button className={`button ${styles.submit}`} type="submit" disabled={submitting}>
        {submitting ? 'Verifying...' : 'Verify'}
      </button>
      <button className={styles.secondary} type="button" onClick={onBack} disabled={submitting}>
        Back
      </button>
    </form>
  );
}
