import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';
import { describeFilters, presetRange } from './dashboardFilters.js';

const FAMILIES = [{ id: 3, name: 'Jha Household', role: 'owner' }];
const THIS_MONTH = presetRange('this-month');
const TWO_CURRENCIES = {
  currencies: [
    {
      currency: 'INR', total: '12450.00', categories: [
        { category_id: 1, name: 'Grocery', color: '#8aa84a', total: '8000.00' },
        { category_id: 3, name: 'Trips', color: '#3a9e84', total: '4450.00' },
      ],
    },
    {
      currency: 'USD', total: '85.00', categories: [
        { category_id: 2, name: 'Eating Out', color: '#e08e5a', total: '60.00' },
        { category_id: 3, name: 'Trips', color: '#3a9e84', total: '25.00' },
      ],
    },
  ],
};

/**
 * Logged in with `families`; `summaries(params)` answers each summary request.
 * Returns the query of every summary request made.
 */
function mockDashboard({
  families = FAMILIES, summaries = () => HttpResponse.json({ currencies: [] }),
} = {}) {
  const requests = [];
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json(families)),
    http.get('/api/reports/summary', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return summaries(params);
    }),
  );
  return requests;
}

const card = (name) => screen.getByRole('region', { name });
const chip = (name) => screen.getByRole('button', { name });
const familyRequests = (requests, id) => requests.filter((p) => p.get('family_id') === id);

describe('Dashboard summaries', () => {
  it('shows a Personal card followed by one card per family', async () => {
    mockDashboard({ families: [...FAMILIES, { id: 4, name: 'Trip Crew', role: 'member' }] });
    renderApp('/');
    await screen.findByRole('region', { name: 'Personal' });
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles.slice(0, 3)).toEqual(['Personal', 'Jha Household', 'Trip Crew']);
  });

  it('shows only the Personal card without families', async () => {
    mockDashboard({ families: [] });
    renderApp('/');
    await screen.findByRole('region', { name: 'Personal' });
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Personal');
    expect(screen.queryByRole('region', { name: 'Jha Household' })).not.toBeInTheDocument();
  });

  it('asks for personal and family totals separately, for this month', async () => {
    const requests = mockDashboard();
    renderApp('/');
    await waitFor(() => expect(requests).toHaveLength(2));
    const personal = requests.find((p) => !p.has('family_id'));
    expect(Object.fromEntries(personal)).toEqual({
      date_from: THIS_MONTH.from, date_to: THIS_MONTH.to,
    });
    expect(familyRequests(requests, '3')).toHaveLength(1);
  });

  it('loads each card once when nothing changes', async () => {
    const requests = mockDashboard();
    renderApp('/');
    expect(await screen.findAllByText('No expenses match these filters')).toHaveLength(2);
    await new Promise((resolve) => { setTimeout(resolve, 100); });
    expect(requests).toHaveLength(2);
  });

  it('starts on This month and All categories and describes the selection', async () => {
    mockDashboard();
    renderApp('/');
    expect(await screen.findByRole('radio', { name: 'This month' })).toBeChecked();
    expect(chip('All categories')).toHaveAttribute('aria-pressed', 'true');
    const summary = describeFilters({ ...THIS_MONTH, categoryIds: [] }, CATEGORIES);
    expect(screen.getByText(summary)).toBeInTheDocument();
  });

  it('shows totals per currency with a category breakdown', async () => {
    mockDashboard({ summaries: () => HttpResponse.json(TWO_CURRENCIES) });
    renderApp('/');
    const personal = await screen.findByRole('region', { name: 'Personal' });
    expect(await within(personal).findByText('INR 12,450.00')).toBeInTheDocument();
    expect(within(personal).getByText('USD 85.00')).toBeInTheDocument();
    const inr = within(personal).getByRole('list', { name: 'INR by category' });
    expect(within(inr).getByText('Grocery')).toBeInTheDocument();
    expect(within(inr).getByText('INR 8,000.00')).toBeInTheDocument();
    expect(within(inr).queryByText('Eating Out')).not.toBeInTheDocument();
  });

  it('says when no expenses match', async () => {
    mockDashboard({ families: [] });
    renderApp('/');
    expect(await screen.findByText('No expenses match these filters')).toBeInTheDocument();
  });

  it('offers to add an expense from an empty card, keeping the filters', async () => {
    mockDashboard({ families: [] });
    const search = '?from=2026-03-01&to=2026-03-31';
    const { user, router } = renderApp(`/${search}`);
    const personal = await screen.findByRole('region', { name: 'Personal' });
    await user.click(await within(personal).findByRole('link', { name: 'Add an expense' }));
    expect(router.state.location.pathname).toBe('/expenses/new');
    expect(router.state.location.search).toBe(search);
  });

  it('shows a loading indicator while a card loads', async () => {
    let release;
    mockDashboard({
      families: [],
      summaries: () => new Promise((resolve) => {
        release = () => resolve(HttpResponse.json({ currencies: [] }));
      }),
    });
    renderApp('/');
    const personal = await screen.findByRole('region', { name: 'Personal' });
    expect(within(personal).getByRole('status')).toHaveTextContent('Loading...');
    await waitFor(() => expect(release).toBeDefined());
    release();
    expect(await within(personal).findByText('No expenses match these filters'))
      .toBeInTheDocument();
    expect(within(personal).queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('lets one failed card retry while the others keep working', async () => {
    let familyFails = true;
    mockDashboard({
      summaries: (params) => (params.get('family_id') === '3' && familyFails
        ? HttpResponse.json({ detail: 'boom' }, { status: 500 })
        : HttpResponse.json(TWO_CURRENCIES)),
    });
    const { user } = renderApp('/');
    const family = await screen.findByRole('region', { name: 'Jha Household' });
    expect(await within(family).findByRole('alert')).toHaveTextContent('Could not load');
    expect(await within(card('Personal')).findByText('USD 85.00')).toBeInTheDocument();
    familyFails = false;
    await user.click(within(family).getByRole('button', { name: 'Retry' }));
    expect(await within(family).findByText('USD 85.00')).toBeInTheDocument();
    expect(within(family).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('updates every card when the period changes', async () => {
    const requests = mockDashboard();
    const { user, router } = renderApp('/');
    await user.click(await screen.findByRole('radio', { name: 'Last month' }));
    const lastMonth = presetRange('last-month');
    await waitFor(() => expect(requests).toHaveLength(4));
    for (const params of requests.slice(2)) {
      expect(params.get('date_from')).toBe(lastMonth.from);
      expect(params.get('date_to')).toBe(lastMonth.to);
    }
    expect(router.state.location.search).toBe(`?from=${lastMonth.from}&to=${lastMonth.to}`);
  });

  it('filters by the chosen categories and back to all', async () => {
    const requests = mockDashboard({ families: [] });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Grocery' }));
    await user.click(chip('Trips'));
    await waitFor(() => expect(requests.at(-1).getAll('category_id')).toEqual(['1', '3']));
    expect(chip('All categories')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/· Grocery, Trips$/)).toBeInTheDocument();
    await user.click(chip('All categories'));
    await waitFor(() => expect(requests.at(-1).getAll('category_id')).toEqual([]));
  });

  it('applies a custom range and keeps results when From is after To', async () => {
    const requests = mockDashboard({
      families: [], summaries: () => HttpResponse.json(TWO_CURRENCIES),
    });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('radio', { name: 'Custom' }));
    const from = screen.getByLabelText('From');
    const to = screen.getByLabelText('To');
    await user.clear(from);
    await user.type(from, '2026-03-05');
    await user.clear(to);
    await user.type(to, '2026-03-10');
    await waitFor(() => expect(requests.at(-1).get('date_to')).toBe('2026-03-10'));
    expect(requests.at(-1).get('date_from')).toBe('2026-03-05');
    expect(screen.getByText('5 Mar 2026 – 10 Mar 2026 · All categories')).toBeInTheDocument();

    const count = requests.length;
    await user.clear(from);
    await user.type(from, '2026-03-20');
    expect(from).toHaveAccessibleDescription('The From date must be on or before the To date.');
    expect(requests).toHaveLength(count);
    expect(within(card('Personal')).getByText('USD 85.00')).toBeInTheDocument();
  });

  it('reads filters from the URL and resets them', async () => {
    const requests = mockDashboard({ families: [] });
    const { user, router } = renderApp('/?from=2026-03-05&to=2026-03-10&category=2');
    expect(await screen.findByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(chip('Eating Out')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(requests[0].get('category_id')).toBe('2'));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
    expect(chip('All categories')).toHaveAttribute('aria-pressed', 'true');
    expect(router.state.location.search).toBe('');
  });

  it('keeps the filters and refreshes the cards after adding an expense', async () => {
    let saved = false;
    const requests = mockDashboard({
      families: [],
      summaries: () => HttpResponse.json(saved ? TWO_CURRENCIES : { currencies: [] }),
    });
    server.use(http.post('/api/expenses', async ({ request }) => {
      saved = true;
      const body = await request.json();
      return HttpResponse.json(
        { id: 9, user_id: 1, ...body, category: CATEGORIES[0] }, { status: 201 },
      );
    }));
    const search = '?from=2026-03-01&to=2026-03-31&category=1';
    const { user, router } = renderApp(`/${search}`);
    await user.click(await screen.findByRole('link', { name: 'Add expense' }));
    await user.type(await screen.findByLabelText('Amount'), '85');
    await user.selectOptions(screen.getByLabelText('Category'), 'Grocery');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Expense saved/)).toBeInTheDocument();
    expect(router.state.location.search).toBe(search);
    const personal = await screen.findByRole('region', { name: 'Personal' });
    expect(await within(personal).findByText('USD 85.00')).toBeInTheDocument();
    expect(requests.at(-1).get('date_from')).toBe('2026-03-01');
  });

  it('follows the URL when it changes outside the filters', async () => {
    const requests = mockDashboard({ families: [] });
    const { user } = renderApp('/?from=2026-03-05&to=2026-03-10');
    expect(await screen.findByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByLabelText('From')).toHaveValue('2026-03-05');
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(requests.at(-1).get('date_from')).toBe(THIS_MONTH.from));
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });

  it('keeps Custom open with the applied dates after choosing it', async () => {
    mockDashboard({ families: [] });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('radio', { name: 'Custom' }));
    expect(screen.getByLabelText('From')).toHaveValue(THIS_MONTH.from);
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked();
    expect(screen.getByLabelText('To')).toHaveValue(THIS_MONTH.to);
  });

  it('drops a custom range the user entered when the URL changes elsewhere', async () => {
    const requests = mockDashboard({ families: [] });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('radio', { name: 'Custom' }));
    await user.clear(screen.getByLabelText('From'));
    await user.type(screen.getByLabelText('From'), '2026-03-05');
    await waitFor(() => expect(requests.at(-1).get('date_from')).toBe('2026-03-05'));
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(requests.at(-1).get('date_from')).toBe(THIS_MONTH.from));
    expect(screen.getByRole('radio', { name: 'This month' })).toBeChecked();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });
});
