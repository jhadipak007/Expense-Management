import { Link } from 'react-router';
import { listFamilies } from '../../api/families.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import page from '../../styles/page.module.css';
import { ROLE_LABELS } from '../../utils/format.js';
import CreateFamilyForm from './CreateFamilyForm.jsx';

/** The user's families with their role in each, and a form to create one. */
export default function Families() {
  const { data: families, error, loading, reload } = useAsyncList(listFamilies);

  return (
    <div className={page.stack}>
      <section className={page.card}>
        <h1 className={page.title}>Families</h1>
        {loading && <p className={page.muted}>Loading...</p>}
        {error && <p className={page.error} role="alert">Could not load your families.</p>}
        {families?.length === 0 && (
          <p className={page.muted}>You are not in a family yet. Create one below.</p>
        )}
        {families?.length > 0 && (
          <ul className={page.list}>
            {families.map((family) => (
              <li key={family.id} className={page.item}>
                <Link className={page.name} to={`/families/${family.id}`}>{family.name}</Link>
                <span className={page.badge}>{ROLE_LABELS[family.role]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CreateFamilyForm onCreated={reload} />
    </div>
  );
}
