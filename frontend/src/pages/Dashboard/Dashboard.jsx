import { Link, useLocation, useSearchParams } from 'react-router';
import { listCategoriesAndFamilies } from '../../api/expenses.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import { useAuth } from '../../auth/useAuth.js';
import page from '../../styles/page.module.css';
import styles from './Dashboard.module.css';
import DashboardFilters from './DashboardFilters.jsx';
import { parseFilters, toSearchParams } from './dashboardFilters.js';
import PendingInvitations from './PendingInvitations.jsx';
import SummaryCard from './SummaryCard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const saved = location.state?.savedExpense;
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const options = useAsyncList(listCategoriesAndFamilies);

  return (
    <div className={page.stack}>
      {saved && (
        <p className={page.success} role="status">
          Expense saved: {saved.amount} {saved.currency} for {saved.category.name}.
        </p>
      )}
      <section className={styles.card}>
        <h1 className={styles.greeting}>Welcome, {user.display_name}</h1>
        <Link
          className={`button ${styles.add}`}
          to={{ pathname: '/expenses/new', search: location.search }}
        >
          Add expense
        </Link>
      </section>
      {options.loading && !options.data && <p className={page.muted}>Loading...</p>}
      {options.error && (
        <section className={page.card}>
          <p className={page.error} role="alert">Could not load your summaries.</p>
          <button className={page.secondary} type="button" onClick={options.reload}>Retry</button>
        </section>
      )}
      {options.data && (
        <>
          <DashboardFilters
            filters={filters} categories={options.data.categories}
            onChange={(next) => setSearchParams(toSearchParams(next), { replace: true })}
            onReset={() => setSearchParams({}, { replace: true })}
          />
          <div className={styles.cards}>
            <SummaryCard title="Personal" familyId={null} filters={filters} />
            {options.data.families.map((family) => (
              <SummaryCard
                key={family.id} title={family.name} familyId={family.id} filters={filters}
              />
            ))}
          </div>
        </>
      )}
      <PendingInvitations />
    </div>
  );
}
