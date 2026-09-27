import { refreshSession, request, requestPublic, setAccessToken } from './client.js';

export async function login(email, password) {
  const data = await requestPublic('/api/auth/login', {
    method: 'POST',
    body: { email, password },
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
