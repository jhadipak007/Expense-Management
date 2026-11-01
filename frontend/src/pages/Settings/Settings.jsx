import { useState } from 'react';
import { toast } from 'sonner';
import { updateSettings } from '@/api/users.js';
import { useAuth } from '@/auth/useAuth.js';
import { SelectField } from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import UnsavedChangesGuard from '@/components/UnsavedChangesGuard.jsx';
import { NativeSelectOption } from '@/components/ui/native-select';
import { ordinal } from '@/utils/format.js';
import { UNAVAILABLE } from '@/utils/formErrors.js';

/** Days 1 to 28, so every month has the chosen day. */
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** e.g. "Your month runs from the 15th to the 14th of the next month." */
function describeMonth(day) {
  return day === 1
    ? 'Your month runs from the 1st to the last day of the month.'
    : `Your month runs from the ${ordinal(day)} to the ${ordinal(day - 1)} of the next month.`;
}

/** The user's settings, read from and saved back to the session's user. */
export default function Settings() {
  const { user, updateUser } = useAuth();
  return (
    <SectionCard className="max-w-2xl">
      <PageHeader title="Settings" description="Choose how your months work for budgets and the dashboard." />
      <MonthStartForm saved={user.month_start_day} onSaved={updateUser} />
    </SectionCard>
  );
}

function MonthStartForm({ saved, onSaved }) {
  const [day, setDay] = useState(String(saved));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      onSaved(await updateSettings({ month_start_day: Number(day) }));
      toast.success('Settings saved', { description: describeMonth(Number(day)) });
    } catch {
      setFormError(UNAVAILABLE);
    }
    setSubmitting(false);
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <UnsavedChangesGuard dirty={day !== String(saved)} />
      {formError && <Notice>{formError}</Notice>}
      <SelectField
        id="month-start-day" label="Month start day" value={day} onChange={setDay}
        hint={`${describeMonth(Number(day))} Monthly budgets and the dashboard's This month and Last month use it. Family monthly budgets follow the family owner's day.`}
      >
        {DAYS.map((d) => <NativeSelectOption key={d} value={d}>{ordinal(d)}</NativeSelectOption>)}
      </SelectField>
      <SubmitButton pending={submitting} pendingLabel="Saving..." className="md:w-auto md:self-end md:px-10">
        Save settings
      </SubmitButton>
    </form>
  );
}
