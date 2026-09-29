import { useState } from 'react';
import { acceptInvitation, declineInvitation, listMyInvitations } from '@/api/invitations.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import ItemRow, { ItemActions, ItemDetails, ItemList } from '@/components/ItemRow.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading } from '@/components/SectionCard.jsx';
import TextLink from '@/components/TextLink.jsx';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/format.js';

const NO_LONGER_AVAILABLE = 'This invitation is no longer available.';
const UNAVAILABLE = 'Something went wrong. Please try again.';

/** The user's open family invitations with Accept and Decline. Hidden when there are none and nothing failed. */
export default function PendingInvitations() {
  const { data: invitations, error: loadError, reload } = useAsyncList(listMyInvitations);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function respond(invitation, accept) {
    setBusyId(invitation.id);
    setMessage(null);
    try {
      if (accept) {
        const family = await acceptInvitation(invitation.id);
        setMessage({ joined: family });
      } else {
        await declineInvitation(invitation.id);
      }
    } catch (err) {
      setMessage({ error: err.status === 409 ? NO_LONGER_AVAILABLE : UNAVAILABLE });
    }
    setBusyId(null);
    reload();
  }

  if (!invitations?.length && !message && !loadError) return null;

  return (
    <SectionCard>
      <CardHeading>Family invitations</CardHeading>
      {loadError && <Notice>Could not load your invitations.</Notice>}
      {message?.error && <Notice>{message.error}</Notice>}
      {message?.joined && (
        <Notice kind="success">
          You joined {message.joined.name}.{' '}
          <TextLink to={`/families/${message.joined.id}`}>View family</TextLink>
        </Notice>
      )}
      {invitations?.length > 0 && (
        <ItemList>
          {invitations.map((invitation) => (
            <ItemRow key={invitation.id}>
              <ItemDetails title={invitation.family_name}>
                Invited by {invitation.inviter_name} · Expires {formatDate(invitation.expires_at)}
              </ItemDetails>
              <ItemActions>
                <Button
                  disabled={busyId === invitation.id}
                  aria-label={`Accept invitation to ${invitation.family_name}`}
                  onClick={() => respond(invitation, true)}
                >
                  Accept
                </Button>
                <Button
                  variant="outline" disabled={busyId === invitation.id}
                  aria-label={`Decline invitation to ${invitation.family_name}`}
                  onClick={() => respond(invitation, false)}
                >
                  Decline
                </Button>
              </ItemActions>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </SectionCard>
  );
}
