import { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { acceptInvitation, declineInvitation, listMyInvitations } from '@/api/invitations.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import ConfirmButton from '@/components/ConfirmButton.jsx';
import ItemRow, { ItemActions, ItemList, PersonDetails } from '@/components/ItemRow.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardIntro } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/format.js';

const NO_LONGER_AVAILABLE = 'This invitation is no longer available.';
const UNAVAILABLE = 'Something went wrong. Please try again.';

/**
 * The user's open family invitations with Accept and Decline (confirmed first).
 * Hidden when there are none and nothing failed. `onJoined` runs after joining a family.
 */
export default function PendingInvitations({ onJoined }) {
  const { data: invitations, error: loadError, reload } = useAsyncList(listMyInvitations);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function respond(invitation, accept) {
    setBusyId(invitation.id);
    setError('');
    try {
      if (accept) {
        const family = await acceptInvitation(invitation.id);
        toast.success(`You joined ${family.name}`);
        onJoined();
      } else {
        await declineInvitation(invitation.id);
        toast.success(`Invitation to ${invitation.family_name} declined`);
      }
    } catch (err) {
      setError(err.status === 409 ? NO_LONGER_AVAILABLE : UNAVAILABLE);
    }
    setBusyId(null);
    reload();
  }

  if (!invitations?.length && !error && !loadError) return null;

  return (
    <SectionCard aria-label="Family invitations">
      <CardIntro title="Family invitations" description="Families that asked you to join them" />
      {loadError && <Notice>Could not load your invitations.</Notice>}
      {error && <Notice>{error}</Notice>}
      {invitations?.length > 0 && (
        <ItemList>
          {invitations.map((invitation) => (
            <ItemRow key={invitation.id}>
              <PersonDetails name={invitation.inviter_name} title={invitation.family_name}>
                Invited by {invitation.inviter_name} · Expires {formatDate(invitation.expires_at)}
              </PersonDetails>
              <ItemActions>
                <Button
                  disabled={busyId === invitation.id}
                  aria-label={`Accept invitation to ${invitation.family_name}`}
                  onClick={() => respond(invitation, true)}
                >
                  <CheckIcon />Accept
                </Button>
                <ConfirmButton
                  variant="outline" disabled={busyId === invitation.id}
                  aria-label={`Decline invitation to ${invitation.family_name}`}
                  title={`Decline the invitation to ${invitation.family_name}?`}
                  description={`${invitation.inviter_name} would need to invite you again for you to join.`}
                  confirmLabel="Decline" cancelLabel="Keep invitation"
                  onConfirm={() => respond(invitation, false)}
                >
                  Decline
                </ConfirmButton>
              </ItemActions>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </SectionCard>
  );
}
