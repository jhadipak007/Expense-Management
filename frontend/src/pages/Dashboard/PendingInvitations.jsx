import { useState } from 'react';
import { Link } from 'react-router';
import { acceptInvitation, declineInvitation, listMyInvitations } from '../../api/invitations.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import page from '../../styles/page.module.css';
import { formatDate } from '../../utils/format.js';

const NO_LONGER_AVAILABLE = 'This invitation is no longer available.';
const UNAVAILABLE = 'Something went wrong. Please try again.';

/** The user's open family invitations with Accept and Decline. Hidden when there are none. */
export default function PendingInvitations() {
  const { data: invitations, reload } = useAsyncList(listMyInvitations);
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

  if (!invitations?.length && !message) return null;

  return (
    <section className={page.card}>
      <h2 className={page.heading}>Family invitations</h2>
      {message?.error && <p className={page.error} role="alert">{message.error}</p>}
      {message?.joined && (
        <p className={page.success} role="status">
          You joined {message.joined.name}.{' '}
          <Link to={`/families/${message.joined.id}`}>View family</Link>
        </p>
      )}
      {invitations?.length > 0 && (
        <ul className={page.list}>
          {invitations.map((invitation) => (
            <li key={invitation.id} className={page.item}>
              <div className={page.details}>
                <span className={page.name}>{invitation.family_name}</span>
                <span className={page.muted}>
                  Invited by {invitation.inviter_name} · Expires {formatDate(invitation.expires_at)}
                </span>
              </div>
              <div className={page.actions}>
                <button
                  className="button" type="button" disabled={busyId === invitation.id}
                  aria-label={`Accept invitation to ${invitation.family_name}`}
                  onClick={() => respond(invitation, true)}
                >
                  Accept
                </button>
                <button
                  className={page.secondary} type="button" disabled={busyId === invitation.id}
                  aria-label={`Decline invitation to ${invitation.family_name}`}
                  onClick={() => respond(invitation, false)}
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
