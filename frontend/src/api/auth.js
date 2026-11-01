import { refreshSession, request, requestPublic, setAccessToken } from './client.js';

// Set while a logout has not reached the server, whose refresh cookie then still holds the session.
const LOGOUT_PENDING = 'logout-pending';

/** Keep the access token of a new session; its refresh cookie replaces any old one. */
function startSession(accessToken) {
  setAccessToken(accessToken);
  localStorage.removeItem(LOGOUT_PENDING);
}

export async function login(email, password) {
  const data = await requestPublic('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  startSession(data.access_token);
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
  startSession(data.access_token);
}

/** End the session on the server. If the request fails, the next app start retries it. */
export async function logout() {
  setAccessToken(null);
  localStorage.setItem(LOGOUT_PENDING, 'true');
  await requestPublic('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem(LOGOUT_PENDING);
}

/**
 * Restore the session from the refresh cookie and return true. A pending
 * logout is retried instead, and false is returned.
 */
export async function restoreSession() {
  if (localStorage.getItem(LOGOUT_PENDING)) {
    await logout();
    return false;
  }
  await refreshSession();
  return true;
}

export function fetchCurrentUser() {
  return request('/api/users/me');
}
