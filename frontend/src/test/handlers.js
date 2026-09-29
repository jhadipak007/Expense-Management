/**
 * Default MSW handlers: a logged-out visitor whose login or sign-up (OTP 2211) as Priya
 * succeeds, with no families, invitations or expenses yet, and the three seeded categories.
 */
import { http, HttpResponse } from 'msw';

export const USER = { id: 1, email: 'priya@example.com', display_name: 'Priya' };

export const CATEGORIES = [
  { id: 1, name: 'Grocery', color: '#8aa84a' },
  { id: 2, name: 'Eating Out', color: '#e08e5a' },
  { id: 3, name: 'Trips', color: '#3a9e84' },
];

export const handlers = [
  http.post('/api/auth/refresh', () =>
    HttpResponse.json({ detail: 'Session expired' }, { status: 401 }),
  ),
  http.post('/api/auth/login', () =>
    HttpResponse.json({ access_token: 'token-1', token_type: 'bearer' }),
  ),
  http.post('/api/auth/register', () =>
    HttpResponse.json({ registration_id: 'reg-1' }, { status: 201 }),
  ),
  http.post('/api/auth/register/verify', async ({ request }) => {
    const { code } = await request.json();
    if (code !== '2211') {
      return HttpResponse.json({ detail: 'Incorrect code, please try again' }, { status: 400 });
    }
    return HttpResponse.json({ access_token: 'token-1', token_type: 'bearer' });
  }),
  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/users/me', () => HttpResponse.json(USER)),
  http.get('/api/invitations', () => HttpResponse.json([])),
  http.get('/api/families', () => HttpResponse.json([])),
  http.get('/api/categories', () => HttpResponse.json(CATEGORIES)),
  http.get('/api/reports/summary', () => HttpResponse.json({ currencies: [] })),
];

/** Handler that makes the refresh cookie valid, i.e. the visitor is logged in. */
export const validRefresh = http.post('/api/auth/refresh', () =>
  HttpResponse.json({ access_token: 'token-restored', token_type: 'bearer' }),
);
