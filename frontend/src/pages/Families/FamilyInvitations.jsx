import { useState } from 'react';
import { cancelInvitation } from '@/api/families.js';
import ItemRow, { ItemActions, ItemDetails, ItemList } from '@/components/ItemRow.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/format.js';

/** The owner's list of pending invitations, each with a Cancel button. */
export default function FamilyInvitations({ familyId, data: invitations, error, loading, reload }) {
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function cancel(invitation) {
    setBusyId(invitation.id);
    setMessage('');
    try {
      await cancelInvitation(familyId, invitation.id);
    } catch (err) {
      setMessage(err.status === 409 ? 'This invitation is no longer pending.'
        : 'Something went wrong. Please try again.');
    }
    setBusyId(null);
    reload();
  }

  return (
    <SectionCard>
      <CardHeading>Pending invitations</CardHeading>
      {message && <Notice>{message}</Notice>}
      {loading && <p className="text-sm">Loading...</p>}
      {error && <Notice>Could not load invitations.</Notice>}
      {invitations?.length === 0 && <p className="text-sm">No pending invitations.</p>}
      {invitations?.length > 0 && (
        <ItemList>
          {invitations.map((invitation) => (
            <ItemRow key={invitation.id}>
              <ItemDetails title={invitation.invitee_name}>
                Sent {formatDate(invitation.created_at)} · Expires {formatDate(invitation.expires_at)}
              </ItemDetails>
              <ItemActions>
                <Button
                  variant="outline" disabled={busyId === invitation.id}
                  aria-label={`Cancel invitation for ${invitation.invitee_name}`}
                  onClick={() => cancel(invitation)}
                >
                  Cancel
                </Button>
              </ItemActions>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </SectionCard>
  );
}
