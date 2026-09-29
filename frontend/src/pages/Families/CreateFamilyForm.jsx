import { useState } from 'react';
import { createFamily } from '../../api/families.js';
import FormField from '@/components/FormField.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';

const UNAVAILABLE = 'Something went wrong. Please try again.';

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
      await createFamily(name.trim());
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
        <CardHeading>Create a family</CardHeading>
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
