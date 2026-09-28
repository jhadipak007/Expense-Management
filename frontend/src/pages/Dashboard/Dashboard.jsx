import { useAuth } from '../../auth/useAuth.js';
import page from '../../styles/page.module.css';
import styles from './Dashboard.module.css';
import PendingInvitations from './PendingInvitations.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className={page.stack}>
      <section className={styles.card}>
        <h1 className={styles.greeting}>Welcome, {user.display_name}</h1>
        <p>Your expenses will appear here.</p>
      </section>
      <PendingInvitations />
    </div>
  );
}
