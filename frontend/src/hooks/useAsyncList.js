import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data with `load()` on mount and whenever `load` changes.
 * Returns `{ data, error, loading, reload }`; wrap `load` in useCallback.
 * While a load runs the previous data stays, and only the newest load's
 * result is kept, so a slow earlier request cannot overwrite a newer one.
 */
export function useAsyncList(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    setState((current) => ({ ...current, loading: true }));
    try {
      const data = await load();
      if (id === latest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === latest.current) setState({ data: null, error, loading: false });
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
