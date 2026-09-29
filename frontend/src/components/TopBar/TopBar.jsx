import { Button } from '@/components/ui/button';
import { SheetTrigger } from '@/components/ui/sheet';

/** Sticky top bar: the Menu button (below 1024px) opens the nav Sheet. */
export default function TopBar({ onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="mx-auto flex min-h-15 max-w-7xl items-center gap-3 px-4 py-2">
        <SheetTrigger asChild>
          <Button variant="outline" className="border-border px-3 text-foreground lg:hidden">
            Menu
          </Button>
        </SheetTrigger>
        <span className="min-w-0 flex-1 text-xl font-bold wrap-anywhere text-foreground">Expense Sarathi</span>
        <Button onClick={onLogout}>Logout</Button>
      </div>
    </header>
  );
}
