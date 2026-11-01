import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth.js';

/**
 * Pages for logged-in users. Others go to /login, which remembers the page in
 * `state.from`, unless they just logged out.
 */
export function RequireAuth() {
  const { status, signedOut } = useAuth();
  const { pathname, search, hash } = useLocation();
  if (status === 'loading') return null;
  if (status === 'unauthenticated') {
    const state = signedOut ? null : { from: pathname + search + hash };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/**
 * Pages for logged-out visitors (login, sign-up). Logged-in users go to the page
 * remembered in `state.from`, or the dashboard. This is the only redirect after login.
 */
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return null;
  if (status === 'authenticated') return <Navigate to={location.state?.from ?? '/'} replace />;
  return <Outlet />;
}
