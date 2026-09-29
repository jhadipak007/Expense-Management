import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router';
import * as authApi from '@/api/auth.js';
import { setSessionExpiredHandler } from '@/api/client.js';
import { AuthContext } from './useAuth.js';

const LOGGED_OUT = { status: 'unauthenticated', user: null };

/**
 * Holds the session: `status` is 'loading' until the refresh cookie has been
 * tried, then 'authenticated' (with `user`) or 'unauthenticated'.
 * Rendered as the root layout route so every page can use `useAuth()`.
 */
export function AuthProvider() {
  const [session, setSession] = useState({ status: 'loading', user: null });

  const restore = useCallback(async () => {
    try {
      await authApi.restoreSession();
      setSession({ status: 'authenticated', user: await authApi.fetchCurrentUser() });
    } catch {
      setSession(LOGGED_OUT);
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
    setSession({ status: 'authenticated', user: await authApi.fetchCurrentUser() });
  }, []);

  const completeRegistration = useCallback(async (registrationId, code) => {
    await authApi.verifyRegistration(registrationId, code);
    setSession({ status: 'authenticated', user: await authApi.fetchCurrentUser() });
  }, []);

  const logout = useCallback(async () => {
    setSession(LOGGED_OUT);
    await authApi.logout();
  }, []);

  const value = useMemo(
    () => ({ ...session, login, completeRegistration, logout }),
    [session, login, completeRegistration, logout],
  );

  return (
    <AuthContext value={value}>
      <Outlet />
    </AuthContext>
  );
}
