/** Default MSW handlers: a logged-out visitor whose login as Priya succeeds. */
import { http, HttpResponse } from 'msw';

export const USER = { id: 1, email: 'priya@example.com', display_name: 'Priya' };

export const handlers = [
  http.post('/api/auth/refresh', () =>
    HttpResponse.json({ detail: 'Session expired' }, { status: 401 }),
  ),
  http.post('/api/auth/login', () =>
    HttpResponse.json({ access_token: 'token-1', token_type: 'bearer' }),
  ),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/users/me', () => HttpResponse.json(USER)),
];

/** Handler that makes the refresh cookie valid, i.e. the visitor is logged in. */
export const validRefresh = http.post('/api/auth/refresh', () =>
  HttpResponse.json({ access_token: 'token-restored', token_type: 'bearer' }),
);
