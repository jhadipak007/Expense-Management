import { useState } from 'react';
import { cancelInvitation } from '../../api/families.js';
import page from '../../styles/page.module.css';
import { formatDate } from '../../utils/format.js';

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
    <section className={page.card}>
      <h2 className={page.heading}>Pending invitations</h2>
      {message && <p className={page.error} role="alert">{message}</p>}
      {loading && <p className={page.muted}>Loading...</p>}
      {error && <p className={page.error} role="alert">Could not load invitations.</p>}
      {invitations?.length === 0 && <p className={page.muted}>No pending invitations.</p>}
      {invitations?.length > 0 && (
        <ul className={page.list}>
          {invitations.map((invitation) => (
            <li key={invitation.id} className={page.item}>
              <div className={page.details}>
                <span className={page.name}>{invitation.invitee_name}</span>
                <span className={page.muted}>
                  Sent {formatDate(invitation.created_at)} · Expires {formatDate(invitation.expires_at)}
                </span>
              </div>
              <div className={page.actions}>
                <button
                  className={page.secondary} type="button" disabled={busyId === invitation.id}
                  aria-label={`Cancel invitation for ${invitation.invitee_name}`}
                  onClick={() => cancel(invitation)}
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
