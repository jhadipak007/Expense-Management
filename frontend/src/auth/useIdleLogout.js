import { useEffect } from 'react';

export const IDLE_MINUTES = 30;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];

/** Call `onIdle` after `IDLE_MINUTES` without user activity. */
export function useIdleLogout(onIdle) {
  useEffect(() => {
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, IDLE_MINUTES * 60 * 1000);
    };
    reset();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [onIdle]);
}
