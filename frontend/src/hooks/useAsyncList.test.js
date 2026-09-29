import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsyncList } from './useAsyncList.js';

/** A load function whose promise the test resolves by hand. */
function deferredLoad() {
  let resolve;
  const load = () => new Promise((done) => { resolve = done; });
  return { load, resolve: (value) => resolve(value) };
}

describe('useAsyncList', () => {
  it('keeps the newest result when an older load finishes last', async () => {
    const slow = deferredLoad();
    const fast = deferredLoad();
    const { result, rerender } = renderHook(({ load }) => useAsyncList(load), {
      initialProps: { load: slow.load },
    });
    rerender({ load: fast.load });
    await act(async () => fast.resolve('new'));
    await act(async () => slow.resolve('old'));
    expect(result.current.data).toBe('new');
  });

  it('shows loading again while a changed load runs', async () => {
    const first = deferredLoad();
    const second = deferredLoad();
    const { result, rerender } = renderHook(({ load }) => useAsyncList(load), {
      initialProps: { load: first.load },
    });
    await act(async () => first.resolve('first'));
    expect(result.current.loading).toBe(false);
    rerender({ load: second.load });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toBe('first');
    await act(async () => second.resolve('second'));
    expect(result.current).toMatchObject({ data: 'second', loading: false });
  });

  it('shows loading while retrying after an error', async () => {
    let attempt = 0;
    const pending = deferredLoad();
    const load = () => (++attempt === 1 ? Promise.reject(new Error('down')) : pending.load());
    const { result } = renderHook(() => useAsyncList(load));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => { result.current.reload(); });
    expect(result.current.loading).toBe(true);
    await act(async () => pending.resolve('ok'));
    expect(result.current).toMatchObject({ data: 'ok', error: null, loading: false });
  });

  it('aborts the running load when the component unmounts or the load changes', async () => {
    const signals = [];
    const load = (signal) => { signals.push(signal); return new Promise(() => {}); };
    const other = (signal) => { signals.push(signal); return new Promise(() => {}); };
    const { rerender, unmount } = renderHook(({ fn }) => useAsyncList(fn), {
      initialProps: { fn: load },
    });
    rerender({ fn: other });
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    unmount();
    expect(signals[1].aborted).toBe(true);
  });
});
