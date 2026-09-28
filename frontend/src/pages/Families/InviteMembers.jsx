import { useCallback } from 'react';
import { listFamilyInvitations } from '../../api/families.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import FamilyInvitations from './FamilyInvitations.jsx';
import UserSearch from './UserSearch.jsx';

/** Owner-only tools: find and invite people, and manage pending invitations. */
export default function InviteMembers({ familyId }) {
  const load = useCallback(() => listFamilyInvitations(familyId), [familyId]);
  const invitations = useAsyncList(load);
  const invitedIds = (invitations.data ?? []).map((invitation) => invitation.invitee_id);

  return (
    <>
      <UserSearch familyId={familyId} invitedIds={invitedIds} onInvited={invitations.reload} />
      <FamilyInvitations familyId={familyId} {...invitations} />
    </>
  );
}
