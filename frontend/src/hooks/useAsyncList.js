import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Load data with `load(signal)` on mount and whenever `load` changes.
 * Returns `{ data, error, loading, reload }`; wrap `load` in useCallback.
 * While a load runs the previous data stays. Starting a new load, or
 * unmounting, aborts the one in flight, so only the newest result is kept
 * and a page that is left does not hold up the next page's requests.
 */
export function useAsyncList(load) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const current = useRef(null);

  const reload = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setState((previous) => ({ ...previous, loading: true }));
    try {
      const data = await load(controller.signal);
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (!controller.signal.aborted) setState({ data: null, error, loading: false });
    }
  }, [load]);

  useEffect(() => {
    reload();
    return () => current.current?.abort();
  }, [reload]);

  return { ...state, reload };
}
