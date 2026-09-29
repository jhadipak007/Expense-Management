import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '../../utils/format.js';

/** The member's role in a family, as an amber badge. */
export default function RoleBadge({ role }) {
  return (
    <Badge className="self-start bg-accent text-sm font-semibold text-accent-foreground md:self-center">
      {ROLE_LABELS[role]}
    </Badge>
  );
}
