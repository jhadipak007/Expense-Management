import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '../../test/handlers.js';
import { server } from '../../test/setup.js';
import { renderApp } from '../../test/renderApp.jsx';

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

  it('opens and closes the drawer with the Menu button', async () => {
    const { user } = await renderLoggedIn();
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer on Escape', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('navigates and closes the drawer when a link is chosen', async () => {
    const { user, router } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('link', { name: 'Families' }));
    expect(router.state.location.pathname).toBe('/families');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
