import { useState } from 'react';
import { MailIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cancelInvitation } from '@/api/families.js';
import ConfirmButton from '@/components/ConfirmButton.jsx';
import EmptyState from '@/components/EmptyState.jsx';
import ItemRow, { ItemActions, ItemDetails, ItemList } from '@/components/ItemRow.jsx';
import ListSkeleton from '@/components/ListSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardIntro } from '@/components/SectionCard.jsx';
import UserAvatar from '@/components/UserAvatar.jsx';
import { formatDate } from '@/utils/format.js';

/** The owner's list of pending invitations, each with a Cancel button that asks first. */
export default function FamilyInvitations({ familyId, data: invitations, error, loading, reload }) {
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function cancel(invitation) {
    setBusyId(invitation.id);
    setMessage('');
    try {
      await cancelInvitation(familyId, invitation.id);
      toast.success(`Invitation for ${invitation.invitee_name} cancelled`);
    } catch (err) {
      setMessage(err.status === 409 ? 'This invitation is no longer pending.'
        : 'Something went wrong. Please try again.');
    }
    setBusyId(null);
    reload();
  }

  return (
    <SectionCard aria-label="Pending invitations">
      <CardIntro title="Pending invitations" description="People you invited who have not answered yet" />
      {message && <Notice>{message}</Notice>}
      {loading && !invitations && <ListSkeleton />}
      {error && <Notice>Could not load invitations.</Notice>}
      {invitations?.length === 0 && (
        <EmptyState
          icon={MailIcon} title="No pending invitations"
          description="Search for people above to invite them."
        />
      )}
      {invitations?.length > 0 && (
        <ItemList>
          {invitations.map((invitation) => (
            <ItemRow key={invitation.id}>
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={invitation.invitee_name} />
                <ItemDetails title={invitation.invitee_name}>
                  Sent {formatDate(invitation.created_at)} · Expires {formatDate(invitation.expires_at)}
                </ItemDetails>
              </div>
              <ItemActions>
                <ConfirmButton
                  variant="outline" disabled={busyId === invitation.id}
                  aria-label={`Cancel invitation for ${invitation.invitee_name}`}
                  title={`Cancel the invitation for ${invitation.invitee_name}?`}
                  description="They will no longer be able to join. You can invite them again later."
                  confirmLabel="Cancel invitation" cancelLabel="Keep invitation"
                  onConfirm={() => cancel(invitation)}
                >
                  Cancel
                </ConfirmButton>
              </ItemActions>
            </ItemRow>
          ))}
        </ItemList>
      )}
    </SectionCard>
  );
}
