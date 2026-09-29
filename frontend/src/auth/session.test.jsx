import { act, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
