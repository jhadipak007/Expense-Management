import { useState } from 'react';
import { createFamily } from '../../api/families.js';
import FormField from '@/components/FormField.jsx';
import page from '../../styles/page.module.css';

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
    <form className={`${page.card} ${page.form}`} onSubmit={handleSubmit} noValidate>
      <h2 className={page.heading}>Create a family</h2>
      {formError && <p className={page.error} role="alert">{formError}</p>}
      <FormField
        id="family-name" label="Family name" maxLength={100}
        value={name} onChange={setName} error={error}
      />
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create family'}
      </button>
    </form>
  );
}
