import { useState } from 'react';
import { inviteUser, searchUsers } from '../../api/families.js';
import FormField from '@/components/FormField.jsx';
import page from '../../styles/page.module.css';

const UNAVAILABLE = 'Something went wrong. Please try again.';
const MODES = { email: 'Email', name: 'Name' };

function validate(mode, value) {
  if (mode === 'name' && value.length < 3) return 'Enter at least 3 characters';
  if (mode === 'email' && !value) return 'Enter an email address';
  return '';
}

/** Owner-only: find users by exact email or part of a name, and invite them. */
export default function UserSearch({ familyId, invitedIds, onInvited }) {
  const [mode, setMode] = useState('email');
  const [query, setQuery] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [search, setSearch] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  function changeMode(next) {
    setMode(next);
    setQuery('');
    setFieldError('');
    setSearch(null);
    setMessage(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const value = query.trim();
    const error = validate(mode, value);
    setFieldError(error);
    setMessage(null);
    if (error) return;
    setBusy(true);
    try {
      setSearch(await searchUsers(familyId, { [mode]: value }));
    } catch (err) {
      setSearch(null);
      setMessage({ error: err.status === 422 ? 'Enter a valid email address.' : UNAVAILABLE });
    }
    setBusy(false);
  }

  async function invite(person) {
    setBusy(true);
    setMessage(null);
    try {
      await inviteUser(familyId, person.user_id);
      setMessage({ success: `Invitation sent to ${person.display_name}.` });
      onInvited();
    } catch (err) {
      // 404 and 409 carry a message that explains why this person can't be invited.
      setMessage({ error: [404, 409].includes(err.status) ? err.body.detail : UNAVAILABLE });
    }
    setBusy(false);
  }

  return (
    <section className={page.card}>
      <h2 className={page.heading}>Invite people</h2>
      <form className={page.form} onSubmit={handleSubmit} noValidate>
        <fieldset className={page.options}>
          <legend>Find people by</legend>
          {Object.entries(MODES).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio" name="search-mode" value={value}
                checked={mode === value} onChange={() => changeMode(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <FormField
          id="search-query" label={MODES[mode]} type={mode === 'email' ? 'email' : 'text'}
          maxLength={mode === 'email' ? 320 : 100} value={query} onChange={setQuery}
          error={fieldError}
        />
        <button className="button" type="submit" disabled={busy}>Search</button>
      </form>

      {message?.error && <p className={page.error} role="alert">{message.error}</p>}
      {message?.success && <p className={page.success} role="status">{message.success}</p>}
      {search && <SearchResults search={search} invitedIds={invitedIds} busy={busy} onInvite={invite} />}
    </section>
  );
}

function SearchResults({ search, invitedIds, busy, onInvite }) {
  if (search.results.length === 0) return <p className={page.muted}>No user found.</p>;
  return (
    <>
      {search.has_more && (
        <p className={page.muted}>
          Showing the first 10 matches. Narrow your search to find others.
        </p>
      )}
      <ul className={page.list} aria-label="Search results">
        {search.results.map((person) => (
          <li key={person.user_id} className={page.item}>
            <div className={page.details}>
              <span className={page.name}>{person.display_name}</span>
              <span className={page.muted}>{person.email}</span>
            </div>
            <div className={page.actions}>
              {invitedIds.includes(person.user_id) ? (
                <span className={page.muted}>Invited</span>
              ) : (
                <button
                  className="button" type="button" disabled={busy}
                  aria-label={`Invite ${person.display_name}`} onClick={() => onInvite(person)}
                >
                  Invite
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
