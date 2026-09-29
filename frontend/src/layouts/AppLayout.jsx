import { useState } from 'react';
import { Outlet } from 'react-router';
import { useAuth } from '@/auth/useAuth.js';
import { useIdleLogout } from '@/auth/useIdleLogout.js';
import Nav from '@/components/Nav/Nav.jsx';
import TopBar from '@/components/TopBar/TopBar.jsx';
import { Sheet } from '@/components/ui/sheet';

/** Shell for logged-in pages: top bar, navigation, page content and the idle logout timer. */
export default function AppLayout() {
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  useIdleLogout(logout);

  return (
    <Sheet open={navOpen} onOpenChange={setNavOpen}>
      <TopBar onLogout={logout} />
      <div className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-[14rem_minmax(0,1fr)]">
        <Nav onNavigate={() => setNavOpen(false)} />
        <main className="min-w-0 p-4 md:px-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </Sheet>
  );
}
