import { act, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from '@/api/client.js';
import { server } from '@/test/setup.js';
import { validRefresh } from '@/test/handlers.js';
import { logOut, renderApp } from '@/test/renderApp.jsx';
import { IDLE_MINUTES } from './useIdleLogout.js';

describe('session and route guards', () => {
  afterEach(() => vi.useRealTimers());

  it('sends a logged-out visitor to login', async () => {
    const { router } = renderApp('/');
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('sends an unknown page to login when logged out', async () => {
    const { router } = renderApp('/reports');
    await screen.findByRole('button', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
  });

  it('restores the session from the refresh cookie on app start', async () => {
    server.use(validRefresh);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
  });

  it('sends a logged-in user away from the login page', async () => {
    server.use(validRefresh);
    const { router } = renderApp('/login');
    await screen.findByRole('heading', { name: 'Welcome, Priya' });
    expect(router.state.location.pathname).toBe('/');
  });

  it('logout calls the API and returns to login', async () => {
    let loggedOut = false;
    server.use(
      validRefresh,
      http.post('/api/auth/logout', () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = renderApp('/');
    await logOut(user);
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(loggedOut).toBe(true);
  });

  it('logout forgets the page, so the next login goes to the dashboard', async () => {
    server.use(validRefresh);
    const { user, router } = renderApp('/families');
    await screen.findByRole('heading', { name: 'Families' });
    await logOut(user);
    await screen.findByRole('button', { name: 'Log in' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state?.from).toBeUndefined();
  });

  it('an expired session remembers the page, so login returns to it', async () => {
    server.use(validRefresh);
    const { user, router } = renderApp('/');
    await screen.findByRole('heading', { name: 'Welcome, Priya' });
    server.use(
      http.post('/api/auth/refresh', () => HttpResponse.json({}, { status: 401 })),
      http.get('/api/families', () => HttpResponse.json({}, { status: 401 }), { once: true }),
    );
    await act(() => router.navigate('/families?tab=mine'));
    await screen.findByRole('button', { name: 'Log in' });
    expect(router.state.location.state?.from).toBe('/families?tab=mine');

    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), 'P@ssw0rd');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Families' })).toBeInTheDocument();
    expect(router.state.location.pathname + router.state.location.search).toBe('/families?tab=mine');
  });

  it('a failed logout is retried on the next app start instead of restoring the session', async () => {
    const calls = { logout: 0, refresh: 0 };
    server.use(
      validRefresh,
      http.post('/api/auth/logout', () => {
        calls.logout += 1;
        return HttpResponse.json({}, { status: 500 });
      }, { once: true }),
    );
    const first = renderApp('/');
    await logOut(first.user);
    await screen.findByRole('button', { name: 'Log in' });
    first.unmount();

    server.use(
      http.post('/api/auth/logout', () => {
        calls.logout += 1;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/auth/refresh', () => {
        calls.refresh += 1;
        return HttpResponse.json({ access_token: 'token-1', token_type: 'bearer' });
      }),
    );
    renderApp('/');
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(calls).toEqual({ logout: 2, refresh: 0 });
  });

  it('after a retried logout succeeds, the next app start restores the session again', async () => {
    server.use(
      validRefresh,
      http.post('/api/auth/logout', () => HttpResponse.json({}, { status: 500 }), { once: true }),
    );
    const first = renderApp('/');
    await logOut(first.user);
    await screen.findByRole('button', { name: 'Log in' });
    first.unmount();

    const second = renderApp('/');
    await screen.findByRole('button', { name: 'Log in' });
    second.unmount();

    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
  });

  it('logging in after a failed logout keeps the new session on the next app start', async () => {
    server.use(validRefresh, http.post('/api/auth/logout', () => HttpResponse.json({}, { status: 500 })));
    const first = renderApp('/');
    await logOut(first.user);
    await screen.findByRole('button', { name: 'Log in' });
    await first.user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await first.user.type(screen.getByLabelText('Password'), 'P@ssw0rd');
    await first.user.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByRole('heading', { name: 'Welcome, Priya' });
    first.unmount();

    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
  });

  it('going back to the dashboard after logout shows login', async () => {
    server.use(validRefresh);
    const { user, router } = renderApp('/');
    await logOut(user);
    await screen.findByRole('button', { name: 'Log in' });
    await act(() => router.navigate('/'));
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByRole('heading', { name: /^Welcome,/ })).not.toBeInTheDocument();
  });

  it('re-checks the session when the page is restored from the back-forward cache', async () => {
    server.use(validRefresh);
    renderApp('/');
    await screen.findByRole('heading', { name: 'Welcome, Priya' });
    server.use(
      http.post('/api/auth/refresh', () => HttpResponse.json({}, { status: 401 })),
    );
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('logs out after the idle period', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(validRefresh);
    renderApp('/', { advanceTimers: vi.advanceTimersByTime });
    await screen.findByRole('heading', { name: 'Welcome, Priya' });

    await act(() => vi.advanceTimersByTimeAsync((IDLE_MINUTES * 60 - 1) * 1000));
    expect(screen.getByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('activity resets the idle timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(validRefresh);
    renderApp('/', { advanceTimers: vi.advanceTimersByTime });
    await screen.findByRole('heading', { name: 'Welcome, Priya' });

    await act(() => vi.advanceTimersByTimeAsync((IDLE_MINUTES - 1) * 60 * 1000));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown')));
    await act(() => vi.advanceTimersByTimeAsync(2 * 60 * 1000));
    expect(screen.getByRole('heading', { name: 'Welcome, Priya' })).toBeInTheDocument();
  });
});

describe('a login whose user cannot be loaded', () => {
  /** /api/users/me fails once; /api/auth/logout is recorded. */
  function failUserOnce() {
    const calls = { logout: 0 };
    server.use(
      http.get('/api/users/me', () => HttpResponse.json({}, { status: 500 }), { once: true }),
      http.post('/api/auth/logout', () => {
        calls.logout += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return calls;
  }

  /** The Authorization header the next API call sends. */
  async function nextAuthorization() {
    let seen = 'not called';
    server.use(
      http.get('/api/categories', ({ request: req }) => {
        seen = req.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );
    await request('/api/categories');
    return seen;
  }

  async function logInAsPriya(user) {
    await screen.findByRole('button', { name: 'Log in' });
    await user.type(screen.getByLabelText('Email'), 'priya@example.com');
    await user.type(screen.getByLabelText('Password'), 'P@ssw0rd');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
  }

  it('ends the new session and drops the access token after login', async () => {
    const calls = failUserOnce();
    const { user, router } = renderApp('/login');
    await logInAsPriya(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(router.state.location.pathname).toBe('/login');
    await vi.waitFor(() => expect(calls.logout).toBe(1));
    expect(await nextAuthorization()).toBeNull();
    expect(localStorage.getItem('logout-pending')).toBeNull();
  });

  it('ends the new session after sign-up verification', async () => {
    const calls = failUserOnce();
    const { user } = renderApp('/register');
    const fields = { Name: 'Priya', Email: 'priya@example.com', Password: 'P@ssw0rd',
      'Confirm password': 'P@ssw0rd' };
    for (const [label, value] of Object.entries(fields)) {
      await user.type(await screen.findByLabelText(label), value);
    }
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await user.type(await screen.findByLabelText('Code'), '2211');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await vi.waitFor(() => expect(calls.logout).toBe(1));
    expect(await nextAuthorization()).toBeNull();
  });

  it('retries ending the session on the next app start when that logout also fails', async () => {
    const calls = { logout: 0, refresh: 0 };
    server.use(
      http.get('/api/users/me', () => HttpResponse.json({}, { status: 500 }), { once: true }),
      http.post('/api/auth/logout', () => {
        calls.logout += 1;
        return HttpResponse.json({}, { status: calls.logout === 1 ? 500 : 204 });
      }),
    );
    const first = renderApp('/login');
    await logInAsPriya(first.user);
    await screen.findByRole('alert');
    await vi.waitFor(() => expect(calls.logout).toBe(1));
    first.unmount();

    server.use(
      http.post('/api/auth/refresh', () => {
        calls.refresh += 1;
        return HttpResponse.json({ access_token: 'token-1', token_type: 'bearer' });
      }),
    );
    renderApp('/');
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(calls).toEqual({ logout: 2, refresh: 0 });
  });
});
