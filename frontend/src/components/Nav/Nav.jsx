import { NavLink } from 'react-router';
import styles from './Nav.module.css';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/families', label: 'Families' },
];

/** Main navigation: a drawer below 1024px (shown when `open`), a sidebar above. */
export default function Nav({ open, onClose }) {
  const linkClass = ({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`;
  return (
    <>
      {open && (
        <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      )}
      <nav id="main-nav" aria-label="Main" className={`${styles.nav} ${open ? styles.open : ''}`}>
        <ul className={styles.list}>
          {LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={linkClass} onClick={onClose}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
