import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import * as authApi from '@/api/auth.js';
import { setSessionExpiredHandler } from '@/api/client.js';
import { AuthContext } from './useAuth.js';

const LOGGED_OUT = { status: 'unauthenticated', user: null };
const SIGNED_OUT = { ...LOGGED_OUT, signedOut: true };

/**
 * Holds the session: `status` is 'loading' until the refresh cookie has been
 * tried, then 'authenticated' (with `user`) or 'unauthenticated'. `signedOut`
 * marks a logout in this tab, so the next login does not reopen that user's page.
 * Rendered as the root layout route so every page can use `useAuth()`.
 */
export function AuthProvider() {
  const [session, setSession] = useState({ status: 'loading', user: null });

  const restore = useCallback(async () => {
    try {
      if (await authApi.restoreSession()) {
        setSession({ status: 'authenticated', user: await authApi.fetchCurrentUser() });
      } else {
        setSession(LOGGED_OUT);
      }
    } catch {
      setSession(LOGGED_OUT);
    }
  }, []);

  /**
   * Load the user of a session just started by login or sign-up. If that fails, end the
   * session (token and refresh cookie) so the app is fully logged out, then rethrow.
   */
  const enterSession = useCallback(async () => {
    try {
      setSession({ status: 'authenticated', user: await authApi.fetchCurrentUser() });
    } catch (error) {
      await authApi.logout().catch(() => {}); // Retried by restoreSession() on the next app start.
      throw error;
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setSession(LOGGED_OUT));
    restore();
    // A page restored from the back-forward cache skips React; re-check the session.
    const onPageShow = (event) => event.persisted && restore();
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [restore]);

  const login = useCallback(async (email, password) => {
    await authApi.login(email, password);
    await enterSession();
  }, [enterSession]);

  const completeRegistration = useCallback(async (registrationId, code) => {
    await authApi.verifyRegistration(registrationId, code);
    await enterSession();
  }, [enterSession]);

  const logout = useCallback(async () => {
    setSession(SIGNED_OUT);
    await authApi.logout().catch(() => {}); // Retried by restoreSession() on the next app start.
  }, []);

  /** Replace the logged-in user, e.g. after a settings change, so every page sees it at once. */
  const updateUser = useCallback((user) => setSession((current) => ({ ...current, user })), []);

  const value = useMemo(
    () => ({ ...session, login, completeRegistration, logout, updateUser }),
    [session, login, completeRegistration, logout, updateUser],
  );

  return (
    <AuthContext value={value}>
      <Outlet />
    </AuthContext>
  );
}
