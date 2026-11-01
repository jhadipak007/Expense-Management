import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { describeFilters, presetRange } from '@/pages/Dashboard/dashboardFilters.js';
import { CATEGORIES, USER, validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { logOut, renderApp } from '@/test/renderApp.jsx';

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

  it('explains the chosen day with an example', async () => {
    mockSettings();
    const { user } = renderApp('/settings');
    const select = await screen.findByLabelText('Month start day');
    expect(select).toHaveAccessibleDescription(/^Your month runs from the 15th to the 14th of the next month\./);
    await user.selectOptions(select, '1st');
    expect(select).toHaveAccessibleDescription(/^Your month runs from the 1st to the last day of the month\./);
  });

  it('applies a saved day across the app straight away', async () => {
    mockSettings({ day: 1 });
    const { user } = renderApp('/settings');
    await user.selectOptions(await screen.findByLabelText('Month start day'), '20th');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    await user.click(within(screen.getAllByRole('navigation', { name: 'Main' })[0])
      .getByRole('link', { name: 'Dashboard' }));
    const range = presetRange('this-month', 20);
    expect(await screen.findByText(describeFilters({ ...range, categoryIds: [] }, CATEGORIES)))
      .toBeInTheDocument();
  });

  describe('with unsaved changes', () => {
    const dashboardLink = () => within(screen.getAllByRole('navigation', { name: 'Main' })[0])
      .getByRole('link', { name: 'Dashboard' });

    async function changeDay(user) {
      await user.selectOptions(await screen.findByLabelText('Month start day'), '20th');
    }

    it('asks before leaving and stays on Keep editing', async () => {
      mockSettings();
      const { user, router } = renderApp('/settings');
      await changeDay(user);
      await user.click(dashboardLink());
      const dialog = await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' });
      await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/settings');
      expect(screen.getByLabelText('Month start day')).toHaveDisplayValue('20th');
    });

    it('stays when Escape closes the dialog', async () => {
      mockSettings();
      const { user, router } = renderApp('/settings');
      await changeDay(user);
      await user.click(dashboardLink());
      await screen.findByRole('alertdialog');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/settings');
    });

    it('leaves on Discard changes', async () => {
      const patched = mockSettings();
      const { user, router } = renderApp('/settings');
      await changeDay(user);
      await user.click(dashboardLink());
      await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
      expect(await screen.findByRole('heading', { name: /Welcome/ })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
      expect(patched).toEqual([]);
    });

    it('leaves without asking when nothing changed or after saving', async () => {
      mockSettings();
      const { user, router } = renderApp('/settings');
      await screen.findByLabelText('Month start day');
      await user.click(dashboardLink());
      expect(await screen.findByRole('heading', { name: /Welcome/ })).toBeInTheDocument();

      await router.navigate('/settings');
      await changeDay(user);
      await user.click(screen.getByRole('button', { name: 'Save settings' }));
      expect(await screen.findByText('Settings saved')).toBeInTheDocument();
      await user.click(dashboardLink());
      expect(await screen.findByRole('heading', { name: /Welcome/ })).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks the browser to confirm closing or reloading the tab only while changed', async () => {
      mockSettings();
      const { user } = renderApp('/settings');
      await screen.findByLabelText('Month start day');
      const unload = () => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(unload()).toBe(false);
      await changeDay(user);
      expect(unload()).toBe(true);
    });

    it('logs out without asking', async () => {
      mockSettings();
      const { user, router } = renderApp('/settings');
      await changeDay(user);
      await logOut(user);
      expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('shows an error when saving fails', async () => {
    mockSettings({ status: 400 });
    const { user } = renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });
});
