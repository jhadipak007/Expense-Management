import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { useIdleLogout } from '../auth/useIdleLogout.js';
import Nav from '../components/Nav/Nav.jsx';
import TopBar from '../components/TopBar/TopBar.jsx';
import styles from './AppLayout.module.css';

/** Shell for logged-in pages: top bar, navigation, page content and the idle logout timer. */
export default function AppLayout() {
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  useIdleLogout(logout);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  return (
    <>
      <TopBar navOpen={navOpen} onToggleNav={() => setNavOpen(!navOpen)} onLogout={logout} />
      <div className={styles.shell}>
        <Nav open={navOpen} onClose={() => setNavOpen(false)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
