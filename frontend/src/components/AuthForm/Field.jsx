import { useState } from 'react';
import styles from './AuthForm.module.css';
import { EyeIcon, EyeOffIcon } from './icons.jsx';

/**
 * Labelled input whose error is linked with aria-describedby.
 * `icon` adds a decorative leading icon; `revealable` makes it a password
 * input with a show/hide toggle named after the label.
 */
export default function Field({ id, label, error, onChange, icon, revealable, type, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const inputClass = [styles.input, icon && styles.hasIcon, revealable && styles.hasToggle]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          id={id}
          type={revealable ? (visible ? 'text' : 'password') : type}
          className={inputClass}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {revealable && (
          <button
            type="button"
            className={styles.toggle}
            aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            onClick={() => setVisible((shown) => !shown)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}
