import { useState } from 'react';
import { toast } from 'sonner';
import { inviteUser, searchUsers } from '@/api/families.js';
import FormField from '@/components/FormField.jsx';
import ItemRow, { ItemActions, ItemList, PersonDetails } from '@/components/ItemRow.jsx';
import Notice from '@/components/Notice.jsx';
import OptionGroup, { Option } from '@/components/OptionGroup.jsx';
import SectionCard, { CardIntro } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function changeMode(next) {
    setMode(next);
    setQuery('');
    setFieldError('');
    setSearch(null);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const value = query.trim();
    const invalid = validate(mode, value);
    setFieldError(invalid);
    setError('');
    if (invalid) return;
    setBusy(true);
    try {
      setSearch(await searchUsers(familyId, { [mode]: value }));
    } catch (err) {
      setSearch(null);
      setError(err.status === 422 ? 'Enter a valid email address.' : UNAVAILABLE);
    }
    setBusy(false);
  }

  async function invite(person) {
    setBusy(true);
    setError('');
    try {
      await inviteUser(familyId, person.user_id);
      toast.success(`Invitation sent to ${person.display_name}`);
      onInvited();
    } catch (err) {
      // 404 and 409 carry a message that explains why this person can't be invited.
      setError([404, 409].includes(err.status) ? err.body.detail : UNAVAILABLE);
    }
    setBusy(false);
  }

  return (
    <SectionCard>
      <CardIntro title="Invite people" description="Find someone by their exact email or part of their name." />
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <OptionGroup legend="Find people by">
          <RadioGroup value={mode} onValueChange={changeMode} className="flex flex-wrap gap-x-4 gap-y-0">
            {Object.entries(MODES).map(([value, label]) => (
              <Option key={value} label={label}>
                <RadioGroupItem value={value} />
              </Option>
            ))}
          </RadioGroup>
        </OptionGroup>
        <FormField
          id="search-query" label={MODES[mode]} type={mode === 'email' ? 'email' : 'text'}
          maxLength={mode === 'email' ? 320 : 100} value={query} onChange={setQuery}
          error={fieldError}
        />
        <Button type="submit" className="md:self-start" disabled={busy}>Search</Button>
      </form>

      {error && <Notice>{error}</Notice>}
      {search && <SearchResults search={search} invitedIds={invitedIds} busy={busy} onInvite={invite} />}
    </SectionCard>
  );
}

function SearchResults({ search, invitedIds, busy, onInvite }) {
  if (search.results.length === 0) return <p className="text-sm">No user found.</p>;
  return (
    <>
      {search.has_more && (
        <p className="text-sm">
          Showing the first 10 matches. Narrow your search to find others.
        </p>
      )}
      <ItemList aria-label="Search results">
        {search.results.map((person) => (
          <ItemRow key={person.user_id}>
            <PersonDetails name={person.display_name}>{person.email}</PersonDetails>
            <ItemActions>
              {invitedIds.includes(person.user_id) ? (
                <span className="text-sm">Invited</span>
              ) : (
                <Button
                  disabled={busy}
                  aria-label={`Invite ${person.display_name}`} onClick={() => onInvite(person)}
                >
                  Invite
                </Button>
              )}
            </ItemActions>
          </ItemRow>
        ))}
      </ItemList>
    </>
  );
}
