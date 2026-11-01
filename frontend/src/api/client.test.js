import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/setup.js';
import { logger } from '@/utils/logger.js';
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

describe('api client error logging', () => {
  it('logs a server error with its request id and no query string', async () => {
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
    server.use(
      http.get('/api/users/search', () =>
        HttpResponse.json(
          { detail: 'Internal server error' },
          { status: 500, headers: { 'X-Request-ID': 'req-500' } },
        ),
      ),
    );
    await expect(request('/api/users/search?email=a@b.com')).rejects.toThrow('API error 500');
    expect(logError).toHaveBeenCalledWith('API error 500: GET /api/users/search', {
      requestId: 'req-500',
    });
    logError.mockRestore();
  });

  it('logs a network failure but not an aborted request', async () => {
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
    server.use(http.get('/api/users/me', () => HttpResponse.error()));
    await expect(request('/api/users/me')).rejects.toThrow();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toBe('Network error: GET /api/users/me');

    const controller = new AbortController();
    controller.abort();
    await expect(request('/api/users/me', { signal: controller.signal })).rejects.toThrow();
    expect(logError).toHaveBeenCalledTimes(1);
    logError.mockRestore();
  });

  it('does not log client errors such as 404', async () => {
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
    server.use(http.get('/api/families/9', () => HttpResponse.json({}, { status: 404 })));
    await expect(request('/api/families/9')).rejects.toThrow('API error 404');
    expect(logError).not.toHaveBeenCalled();
    logError.mockRestore();
  });
});
