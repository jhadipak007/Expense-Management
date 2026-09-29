import { useSyncExternalStore } from 'react';

const KEY = 'theme';
const listeners = new Set();
let theme = localStorage.getItem(KEY)
  ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** Put the current theme on <html>, where the `.dark` variables in global.css apply. */
export function applyTheme() {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Switch to 'light' or 'dark' and remember the choice in this browser. */
export function setTheme(next) {
  theme = next;
  localStorage.setItem(KEY, next);
  applyTheme();
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current theme, 'light' or 'dark': the saved choice, else the system setting. */
export function useTheme() {
  return useSyncExternalStore(subscribe, () => theme);
}
