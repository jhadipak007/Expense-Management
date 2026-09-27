/**
 * Fetch wrapper for /api. Holds the access token in memory only, adds it to
 * every request, and on a 401 refreshes once and retries.
 */

let accessToken = null;
let refreshInFlight = null;
let onSessionExpired = () => {};

export class ApiError extends Error {
  constructor(status, body) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export function setAccessToken(token) {
  accessToken = token;
}

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

async function send(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
}

async function parse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

/**
 * Exchange the refresh cookie for a new access token.
 * Concurrent callers share one request, because the server treats a second
 * use of the same refresh token as reuse and revokes the session.
 */
export function refreshSession() {
  refreshInFlight ??= send('/api/auth/refresh', { method: 'POST' })
    .then(parse)
    .then((data) => {
      accessToken = data.access_token;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/** Call an authenticated endpoint; on 401 refresh once and retry. */
export async function request(path, options) {
  const response = await send(path, options);
  if (response.status !== 401) return parse(response);
  try {
    await refreshSession();
  } catch (error) {
    accessToken = null;
    onSessionExpired();
    throw error;
  }
  return parse(await send(path, options));
}

/** Call a public endpoint (login, logout) without refresh handling. */
export async function requestPublic(path, options) {
  return parse(await send(path, options));
}
