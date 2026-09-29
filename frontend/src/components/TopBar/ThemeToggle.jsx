import { MoonIcon, SunIcon } from 'lucide-react';
import { setTheme, useTheme } from '@/hooks/useTheme.js';
import { Button } from '@/components/ui/button';

/** Switches between the light and dark theme. */
export default function ThemeToggle() {
  const dark = useTheme() === 'dark';
  return (
    <Button
      variant="ghost" size="icon" className="text-foreground"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </Button>
  );
}
