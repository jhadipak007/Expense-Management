import { useState } from 'react';
import { toast } from 'sonner';
import { fetchCurrentUser } from '@/api/auth.js';
import { updateSettings } from '@/api/users.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import { SelectField } from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import SubmitButton from '@/components/SubmitButton.jsx';
import { NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ordinal } from '@/utils/format.js';
import { UNAVAILABLE } from '@/utils/formErrors.js';

/** Days 1 to 28, so every month has the chosen day. */
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** The user's settings. Loads the user itself so it always shows the saved value. */
export default function Settings() {
  const { data: user, error, loading } = useAsyncList(fetchCurrentUser);
  return (
    <SectionCard className="max-w-2xl">
      <PageHeader title="Settings" description="Choose how your budgets work." />
      {loading && !user && <Skeleton className="h-24 w-full" role="status" aria-label="Loading..." />}
      {error && <Notice>Could not load your settings. Please try again.</Notice>}
      {user && <MonthStartForm saved={user.month_start_day} />}
    </SectionCard>
  );
}

function MonthStartForm({ saved }) {
  const [day, setDay] = useState(String(saved));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await updateSettings({ month_start_day: Number(day) });
      toast.success('Settings saved', { description: `Monthly budgets start on the ${ordinal(Number(day))}.` });
    } catch {
      setFormError(UNAVAILABLE);
    }
    setSubmitting(false);
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {formError && <Notice>{formError}</Notice>}
      <SelectField
        id="month-start-day" label="Month start day" value={day} onChange={setDay}
        hint="Your monthly budgets run from this day to the day before it next month. Family monthly budgets follow the family owner's day."
      >
        {DAYS.map((d) => <NativeSelectOption key={d} value={d}>{ordinal(d)}</NativeSelectOption>)}
      </SelectField>
      <SubmitButton pending={submitting} pendingLabel="Saving..." className="md:w-auto md:self-end md:px-10">
        Save settings
      </SubmitButton>
    </form>
  );
}
