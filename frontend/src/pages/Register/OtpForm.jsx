import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import AuthCard from '@/components/AuthLayout/AuthCard.jsx';
import FormField from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import { Button } from '@/components/ui/button';

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
    <AuthCard
      title="Confirm your sign-up"
      subtitle="Enter the 4-digit code to finish creating your account."
      onSubmit={handleSubmit}
    >
      {formError && <Notice>{formError}</Notice>}

      <FormField
        id="code" label="Code" inputMode="numeric" autoComplete="one-time-code"
        value={code} onChange={setCode} error={codeError}
      />

      <SubmitButton pending={submitting} pendingLabel="Verifying...">Verify</SubmitButton>
      <Button variant="outline" className="w-full" type="button" onClick={onBack} disabled={submitting}>
        Back
      </Button>
    </AuthCard>
  );
}
