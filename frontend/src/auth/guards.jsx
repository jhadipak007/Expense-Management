import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth.js';

/** Pages for logged-in users. Others go to /login and come back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return null;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Pages for logged-out visitors (login). Logged-in users go to the dashboard. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}
