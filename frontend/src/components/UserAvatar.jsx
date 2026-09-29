import { cn } from 'cn';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/utils/format.js';

/** A person's initials in a round avatar; the name itself is shown or read out nearby. */
export default function UserAvatar({ name, className }) {
  return (
    <Avatar className={cn('size-9', className)} aria-hidden="true">
      <AvatarFallback className="bg-primary/15 font-bold text-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
