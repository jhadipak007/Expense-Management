import { cn } from 'cn';
import { LayoutDashboardIcon, UsersIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon, end: true },
  { to: '/families', label: 'Families', icon: UsersIcon },
];

const linkClass = ({ isActive }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground',
    isActive && 'bg-primary/10 text-foreground shadow-[inset_3px_0_0_var(--color-primary)] [&>svg]:text-primary',
  );

function NavLinks({ onNavigate }) {
  return (
    <ul className="flex flex-col gap-1">
      {LINKS.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink to={to} end={end} className={linkClass} onClick={onNavigate}>
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Main navigation: a sidebar from 1024px, and below that a Sheet drawer
 * opened by the top bar's Menu button (rendered inside the layout's Sheet).
 */
export default function Nav({ onNavigate }) {
  return (
    <>
      <nav aria-label="Main" className="sticky top-16 hidden self-start px-4 py-8 lg:block">
        <NavLinks />
      </nav>
      <SheetContent side="left" className="w-[min(80%,18rem)] bg-card p-4 pt-16 lg:hidden">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Main navigation</SheetDescription>
        <nav aria-label="Main">
          <NavLinks onNavigate={onNavigate} />
        </nav>
      </SheetContent>
    </>
  );
}
