import { act, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

async function renderLoggedIn(path = '/') {
  server.use(validRefresh);
  const result = renderApp(path);
  await screen.findByRole('navigation', { name: 'Main' });
  return result;
}

describe('Main navigation', () => {
  it('links to the dashboard and families, marking the current page', async () => {
    await renderLoggedIn('/families');
    expect(screen.getByRole('link', { name: 'Families' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('opens the drawer with the Menu button and closes it with Close', async () => {
    const { user } = await renderLoggedIn();
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer on Escape', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer when the window grows to 1024px', async () => {
    let onBreakpoint;
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: (_type, listener) => { onBreakpoint = listener; },
      removeEventListener() {},
    });
    const { user } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    act(() => onBreakpoint({ matches: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('navigates and closes the drawer when a link is chosen', async () => {
    const { user, router } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('link', { name: 'Families' }));
    expect(router.state.location.pathname).toBe('/families');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
