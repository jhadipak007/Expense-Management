import styles from './TopBar.module.css';

export default function TopBar({ onLogout }) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <span className={styles.brand}>Expense Sarathi</span>
        <button className="button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
