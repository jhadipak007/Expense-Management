import { MenuIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SheetTrigger } from '@/components/ui/sheet';
import ThemeToggle from './ThemeToggle.jsx';
import UserMenu from './UserMenu.jsx';

/** Sticky top bar: the Menu button (below 1024px) opens the nav Sheet; the user menu holds Logout. */
export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-2 px-4 py-2">
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="text-foreground lg:hidden" aria-label="Menu">
            <MenuIcon className="size-6" />
          </Button>
        </SheetTrigger>
        <img src="/logo-light.svg" alt="Expense Sarathi" className="h-8 min-w-0 dark:hidden" />
        <img src="/logo-dark.svg" alt="Expense Sarathi" className="hidden h-8 min-w-0 dark:block" />
        <div className="flex-1" />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
