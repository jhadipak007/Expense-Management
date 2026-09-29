import { cn } from 'cn';
import { CrownIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/utils/format.js';

const VARIANTS = {
  owner: 'border-transparent bg-accent text-accent-foreground',
  member: 'border-border bg-transparent text-foreground',
};

/** The member's role in a family: an amber badge with a crown for owners, an outlined one for members. */
export default function RoleBadge({ role }) {
  return (
    <Badge className={cn('self-start text-sm font-semibold md:self-center', VARIANTS[role])}>
      {role === 'owner' && <CrownIcon aria-hidden="true" />}
      {ROLE_LABELS[role]}
    </Badge>
  );
}
