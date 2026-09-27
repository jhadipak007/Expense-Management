import { refreshSession, request, requestPublic, setAccessToken } from './client.js';

export async function login(email, password) {
  const data = await requestPublic('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setAccessToken(data.access_token);
}

/** Start a sign-up; returns the registration id needed to verify the OTP. */
export async function register(displayName, email, password) {
  const data = await requestPublic('/api/auth/register', {
    method: 'POST',
    body: { display_name: displayName, email, password },
  });
  return data.registration_id;
}

/** Verify the OTP; the new account is created and logged in. */
export async function verifyRegistration(registrationId, code) {
  const data = await requestPublic('/api/auth/register/verify', {
    method: 'POST',
    body: { registration_id: registrationId, code },
  });
  setAccessToken(data.access_token);
}

export async function logout() {
  setAccessToken(null);
  await requestPublic('/api/auth/logout', { method: 'POST' });
}

export function restoreSession() {
  return refreshSession();
}

export function fetchCurrentUser() {
  return request('/api/users/me');
}
