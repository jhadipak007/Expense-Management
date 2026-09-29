import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/setup.js';
import { refreshSession, request, setAccessToken, setSessionExpiredHandler } from './client.js';

function countRefreshes(response) {
  const calls = { count: 0 };
  server.use(
    http.post('/api/auth/refresh', () => {
      calls.count += 1;
      return response();
    }),
  );
  return calls;
}

const newToken = () => HttpResponse.json({ access_token: 'token-2', token_type: 'bearer' });

/** /api/users/me that accepts only token-2. */
function meAcceptingToken2() {
  server.use(
    http.get('/api/users/me', ({ request: req }) =>
      req.headers.get('Authorization') === 'Bearer token-2'
        ? HttpResponse.json({ id: 1 })
        : HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 }),
    ),
  );
}

describe('api client', () => {
  it('adds the bearer token when one is held', async () => {
    let seen;
    server.use(
      http.get('/api/users/me', ({ request: req }) => {
        seen = req.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );
    setAccessToken('token-1');
    await request('/api/users/me');
    expect(seen).toBe('Bearer token-1');
  });

  it('refreshes once on 401 and retries the request', async () => {
    meAcceptingToken2();
    const calls = countRefreshes(newToken);
    setAccessToken('stale');
    await expect(request('/api/users/me')).resolves.toEqual({ id: 1 });
    expect(calls.count).toBe(1);
  });

  it('shares one refresh between concurrent 401s', async () => {
    meAcceptingToken2();
    const calls = countRefreshes(newToken);
    setAccessToken('stale');
    await Promise.all([request('/api/users/me'), request('/api/users/me')]);
    expect(calls.count).toBe(1);
  });

  it('shares one refresh between concurrent session restores', async () => {
    const calls = countRefreshes(newToken);
    await Promise.all([refreshSession(), refreshSession()]);
    expect(calls.count).toBe(1);
  });

  it('reports an expired session when refresh fails', async () => {
    server.use(
      http.get('/api/users/me', () => HttpResponse.json({}, { status: 401 })),
    );
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    await expect(request('/api/users/me')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('never writes the token to web storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    countRefreshes(newToken);
    await refreshSession();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
});
