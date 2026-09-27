import { useAuth } from '../../auth/useAuth.js';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <section className={styles.card}>
      <h1 className={styles.greeting}>Welcome, {user.display_name}</h1>
      <p>Your expenses will appear here.</p>
    </section>
  );
}
