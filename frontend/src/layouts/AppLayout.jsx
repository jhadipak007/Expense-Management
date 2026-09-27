import { Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { useIdleLogout } from '../auth/useIdleLogout.js';
import TopBar from '../components/TopBar/TopBar.jsx';
import styles from './AppLayout.module.css';

/** Shell for logged-in pages: top bar, page content and the idle logout timer. */
export default function AppLayout() {
  const { logout } = useAuth();
  useIdleLogout(logout);
  return (
    <>
      <TopBar onLogout={logout} />
      <main className={styles.content}>
        <Outlet />
      </main>
    </>
  );
}
