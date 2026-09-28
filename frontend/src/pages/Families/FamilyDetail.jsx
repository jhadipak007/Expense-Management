import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { getFamily } from '../../api/families.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import page from '../../styles/page.module.css';
import { ROLE_LABELS } from '../../utils/format.js';
import InviteMembers from './InviteMembers.jsx';

/** One family: its members, and for the owner, search, invite and pending invitations. */
export default function FamilyDetail() {
  const { familyId } = useParams();
  const load = useCallback(() => getFamily(familyId), [familyId]);
  const { data: family, error, loading } = useAsyncList(load);

  if (loading) return <p className={page.muted}>Loading...</p>;
  if (error) {
    return (
      <section className={page.card}>
        <p className={page.error} role="alert">
          {error.status === 404 ? 'Family not found.' : 'Could not load this family.'}
        </p>
        <Link className={page.back} to="/families">Back to families</Link>
      </section>
    );
  }

  return (
    <div className={page.stack}>
      <section className={page.card}>
        <Link className={page.back} to="/families">Back to families</Link>
        <h1 className={page.title}>{family.name}</h1>
        <h2 className={page.heading}>Members</h2>
        <ul className={page.list}>
          {family.members.map((member) => (
            <li key={member.user_id} className={page.item}>
              <div className={page.details}>
                <span className={page.name}>{member.display_name}</span>
                <span className={page.muted}>{member.email}</span>
              </div>
              <span className={page.badge}>{ROLE_LABELS[member.role]}</span>
            </li>
          ))}
        </ul>
      </section>
      {family.role === 'owner' && <InviteMembers familyId={family.id} />}
    </div>
  );
}
