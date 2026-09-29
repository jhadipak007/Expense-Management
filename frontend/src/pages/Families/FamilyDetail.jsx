import { useCallback } from 'react';
import { useParams } from 'react-router';
import { getFamily } from '../../api/families.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import BackLink from '@/components/BackLink.jsx';
import ItemRow, { ItemDetails } from '@/components/ItemRow.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading, PageTitle } from '@/components/SectionCard.jsx';
import InviteMembers from './InviteMembers.jsx';
import RoleBadge from './RoleBadge.jsx';

/** One family: its members, and for the owner, search, invite and pending invitations. */
export default function FamilyDetail() {
  const { familyId } = useParams();
  const load = useCallback(() => getFamily(familyId), [familyId]);
  const { data: family, error, loading } = useAsyncList(load);

  if (loading) return <p className="text-sm">Loading...</p>;
  if (error) {
    return (
      <SectionCard>
        <Notice>{error.status === 404 ? 'Family not found.' : 'Could not load this family.'}</Notice>
        <BackLink to="/families">Back to families</BackLink>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard>
        <BackLink to="/families">Back to families</BackLink>
        <PageTitle>{family.name}</PageTitle>
        <CardHeading>Members</CardHeading>
        <ul className="flex flex-col gap-2">
          {family.members.map((member) => (
            <ItemRow key={member.user_id}>
              <ItemDetails>
                <span className="font-semibold text-foreground">{member.display_name}</span>
                <span className="text-sm">{member.email}</span>
              </ItemDetails>
              <RoleBadge role={member.role} />
            </ItemRow>
          ))}
        </ul>
      </SectionCard>
      {family.role === 'owner' && <InviteMembers familyId={family.id} />}
    </div>
  );
}
