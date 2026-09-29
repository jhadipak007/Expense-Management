import { ChevronDownIcon, LogOutIcon } from 'lucide-react';
import { useAuth } from '@/auth/useAuth.js';
import UserAvatar from '@/components/UserAvatar.jsx';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** The signed-in user's avatar and name; opens a menu with Logout. */
export default function UserMenu() {
  const { user, logout } = useAuth();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-1 text-foreground md:px-2">
          <UserAvatar name={user.display_name} />
          <span className="max-w-40 truncate max-md:sr-only">{user.display_name}</span>
          <ChevronDownIcon className="max-md:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-foreground">{user.display_name}</span>
          <span className="truncate font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOutIcon />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
