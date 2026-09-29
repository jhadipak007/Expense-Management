import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { useAuth } from '@/auth/useAuth.js';
import { useIdleLogout } from '@/auth/useIdleLogout.js';
import Nav from '@/components/Nav/Nav.jsx';
import TopBar from '@/components/TopBar/TopBar.jsx';
import { Sheet } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';

/** Shell for logged-in pages: top bar, navigation, page content, toasts and the idle logout timer. */
export default function AppLayout() {
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  useIdleLogout(logout);

  // The drawer only exists below 1024px; close it if the window grows past that.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const close = (event) => event.matches && setNavOpen(false);
    wide.addEventListener('change', close);
    return () => wide.removeEventListener('change', close);
  }, []);

  return (
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <TopBar />
      <div className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-[14rem_minmax(0,1fr)]">
        <Nav onNavigate={() => setNavOpen(false)} />
        <main className="min-w-0 p-4 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" />
    </Sheet>
  );
}
