import { useCallback, useEffect, useState } from 'react';

/**
 * Load data with `load()` on mount and whenever `load` changes.
 * Returns `{ data, error, loading, reload }`; wrap `load` in useCallback.
 */
export function useAsyncList(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const reload = useCallback(async () => {
    try {
      const data = await load();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
