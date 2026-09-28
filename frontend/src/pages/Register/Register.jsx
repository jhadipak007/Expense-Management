import { useState } from 'react';
import { Link } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout.jsx';
import DetailsForm from './DetailsForm.jsx';
import OtpForm from './OtpForm.jsx';

const EMPTY = { displayName: '', email: '', password: '', confirm: '' };
const RESTART = 'Too many incorrect codes, or the code expired. Please sign up again.';

/**
 * Two-step sign-up: details, then the OTP. The account exists only after the
 * OTP is verified, so leaving the OTP step creates nothing.
 */
export default function Register() {
  const [details, setDetails] = useState(EMPTY);
  const [registrationId, setRegistrationId] = useState(null);
  const [notice, setNotice] = useState('');

  function restart() {
    setRegistrationId(null);
    setNotice(RESTART);
  }

  return (
    <AuthLayout>
      {registrationId ? (
        <OtpForm
          registrationId={registrationId}
          onBack={() => setRegistrationId(null)}
          onRestart={restart}
        />
      ) : (
        <DetailsForm
          details={details}
          onChange={setDetails}
          notice={notice}
          onRegistered={(id) => {
            setNotice('');
            setRegistrationId(id);
          }}
          loginLink={<Link to="/login">Log in</Link>}
        />
      )}
    </AuthLayout>
  );
}
