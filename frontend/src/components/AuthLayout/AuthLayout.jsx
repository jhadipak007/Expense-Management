import styles from './AuthLayout.module.css';

const HIGHLIGHTS = [
  'Track grocery, eating out and trips in one place',
  'Share expenses and reports with your family',
  'See totals by currency at a glance',
];

/**
 * Page shell for the login and sign-up screens: a brand block (a band on top
 * below 1024px, a side panel from 1024px) next to the form.
 */
export default function AuthLayout({ children }) {
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <img src="/logo-dark.svg" alt="Expense Sarathi" className={styles.logo} />
        <p className={styles.tagline}>Your guide to everyday spending.</p>
        <ul className={styles.highlights}>
          {HIGHLIGHTS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
      <div className={styles.formPanel}>{children}</div>
    </main>
  );
}
