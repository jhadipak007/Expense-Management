import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setTheme } from '@/hooks/useTheme.js';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { logOut, renderApp } from '@/test/renderApp.jsx';

async function renderLoggedIn() {
  server.use(validRefresh);
  const result = renderApp('/');
  await screen.findByRole('heading', { name: 'Welcome, Priya' });
  return result;
}

describe('Top bar', () => {
  afterEach(() => setTheme('light'));

  it('shows the logo', async () => {
    await renderLoggedIn();
    expect(screen.getAllByRole('img', { name: 'Expense Sarathi' }).length).toBeGreaterThan(0);
  });

  it('opens a user menu with the name, email and Logout', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Priya' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('priya@example.com')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
  });

  it('logs out from the user menu', async () => {
    const { user, router } = await renderLoggedIn();
    await logOut(user);
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('switches to the dark theme and back, remembering the choice', async () => {
    const { user } = await renderLoggedIn();
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
