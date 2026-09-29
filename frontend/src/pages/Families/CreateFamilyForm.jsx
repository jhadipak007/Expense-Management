import { useState } from 'react';
import { toast } from 'sonner';
import { createFamily } from '@/api/families.js';
import FormField from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardIntro } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';

const UNAVAILABLE = 'Something went wrong. Please try again.';

/** Name and create a new family, which the user then owns; confirms with a toast. */
export default function CreateFamilyForm({ onCreated }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setError('Family name is required');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const family = await createFamily(name.trim());
      toast.success(`${family.name} created`);
      setName('');
      onCreated();
    } catch {
      setFormError(UNAVAILABLE);
    }
    setSubmitting(false);
  }

  return (
    <SectionCard>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
        <CardIntro title="Create a family" description="You become its owner and can invite others." />
        {formError && <Notice>{formError}</Notice>}
        <FormField
          id="family-name" label="Family name" maxLength={100}
          value={name} onChange={setName} error={error}
        />
        <Button type="submit" className="md:self-start" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create family'}
        </Button>
      </form>
    </SectionCard>
  );
}
