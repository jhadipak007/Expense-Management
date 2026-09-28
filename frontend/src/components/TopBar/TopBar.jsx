import styles from './TopBar.module.css';

export default function TopBar({ navOpen, onToggleNav, onLogout }) {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <button
          className={styles.menu} type="button" onClick={onToggleNav}
          aria-expanded={navOpen} aria-controls="main-nav"
        >
          Menu
        </button>
        <span className={styles.brand}>Expense Sarathi</span>
        <button className="button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
