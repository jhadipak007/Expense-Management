import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { USER, validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

/** Logged in as a user whose month starts on `day`; returns the bodies PATCHed. */
function mockSettings({ day = 15, status = 200 } = {}) {
  const patched = [];
  server.use(
    validRefresh,
    http.get('/api/users/me', () => HttpResponse.json({ ...USER, month_start_day: day })),
    http.patch('/api/users/me', async ({ request }) => {
      const body = await request.json();
      patched.push(body);
      if (status !== 200) return HttpResponse.json({ detail: 'Bad request' }, { status });
      return HttpResponse.json({ ...USER, ...body });
    }),
  );
  return patched;
}

describe('Settings', () => {
  it('opens from the main navigation and the user menu', async () => {
    mockSettings();
    const { user } = renderApp('/');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main' }))[0];
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    await user.click(screen.getByRole('button', { name: 'Priya' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('shows the saved month start day, offering the 1st to the 28th', async () => {
    mockSettings();
    renderApp('/settings');
    const select = await screen.findByLabelText('Month start day');
    expect(select).toHaveDisplayValue('15th');
    expect(select.options).toHaveLength(28);
    expect(select.options[27]).toHaveTextContent('28th');
  });

  it('saves a new month start day with a toast', async () => {
    const patched = mockSettings();
    const { user } = renderApp('/settings');
    await user.selectOptions(await screen.findByLabelText('Month start day'), '1st');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(patched).toEqual([{ month_start_day: 1 }]);
  });

  it('shows an error when saving fails', async () => {
    mockSettings({ status: 400 });
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});
