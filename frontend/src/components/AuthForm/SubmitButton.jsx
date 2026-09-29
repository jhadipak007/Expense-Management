import styles from './AuthForm.module.css';

/** Full-width submit button; while `pending` it shows a spinner and is disabled. */
export default function SubmitButton({ pending, pendingLabel, disabled, children }) {
  return (
    <button className={`button ${styles.submit}`} type="submit" disabled={pending || disabled}>
      {pending && <span className={styles.spinner} aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
