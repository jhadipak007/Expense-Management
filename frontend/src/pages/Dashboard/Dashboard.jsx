import { Link, useLocation } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import page from '../../styles/page.module.css';
import styles from './Dashboard.module.css';
import PendingInvitations from './PendingInvitations.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const saved = useLocation().state?.savedExpense;
  return (
    <div className={page.stack}>
      {saved && (
        <p className={page.success} role="status">
          Expense saved: {saved.amount} {saved.currency} for {saved.category.name}.
        </p>
      )}
      <section className={styles.card}>
        <h1 className={styles.greeting}>Welcome, {user.display_name}</h1>
        <p>Your expenses will appear here.</p>
        <Link className={`button ${styles.add}`} to="/expenses/new">Add expense</Link>
      </section>
      <PendingInvitations />
    </div>
  );
}
