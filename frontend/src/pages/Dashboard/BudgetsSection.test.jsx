import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';
import { todayIso } from '@/utils/format.js';

const FAMILIES = [
  { id: 3, name: 'Jha Household', role: 'owner' },
  { id: 4, name: 'Trip Crew', role: 'member' },
];

const budget = (fields) => ({
  family_id: null, category_id: null, period: 'monthly', amount: '400.00', currency: 'INR',
  period_start: '2026-09-15', period_end: '2026-10-14', spent: '100.00', remaining: '300.00',
  over_by: '0.00', status: 'on_track', can_manage: true, ...fields,
});

const BUDGETS = [
  budget({ id: 1 }),
  budget({ id: 2, category_id: 1, period: 'weekly', spent: '85.00', remaining: '15.00', status: 'close',
    amount: '100.00', currency: 'AUD', period_start: '2026-09-14', period_end: '2026-09-20' }),
  budget({ id: 3, family_id: 3, category_id: 3, period: 'yearly', spent: '5250.50', remaining: '0.00',
    over_by: '250.50', status: 'over', amount: '5000.00', period_start: '2026-01-01', period_end: '2026-12-31' }),
  budget({ id: 4, family_id: 4, can_manage: false }),
];

/** Logged in with FAMILIES; `budgets()` answers each list request. Returns the list request URLs and deleted ids. */
function mockBudgets(budgets = () => BUDGETS) {
  const calls = { lists: [], deleted: [] };
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json(FAMILIES)),
    http.get('/api/budgets', ({ request }) => {
      calls.lists.push(new URL(request.url));
      return HttpResponse.json(budgets());
    }),
    http.delete('/api/budgets/:id', ({ params }) => {
      calls.deleted.push(Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const group = (name) => screen.findByRole('region', { name: `${name} budgets` });
const items = (region) => within(region).getAllByRole('listitem');

describe('Dashboard budgets', () => {
  it('invites a user with no budgets to create one', async () => {
    mockBudgets(() => []);
    renderApp('/');
    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create budget' })).toHaveAttribute('href', '/budgets/new');
  });

  it('asks for the budgets with the local date', async () => {
    const calls = mockBudgets();
    renderApp('/');
    await group('Personal');
    expect(calls.lists[0].searchParams.get('today')).toBe(todayIso());
  });

  it('groups budgets under Personal and each family name', async () => {
    mockBudgets();
    renderApp('/');
    expect(items(await group('Personal'))).toHaveLength(2);
    expect(items(await group('Jha Household'))).toHaveLength(1);
    expect(items(await group('Trip Crew'))).toHaveLength(1);
  });

  it('shows dates, spent, what is left, progress and a status label', async () => {
    mockBudgets();
    renderApp('/');
    const [monthly, weekly] = items(await group('Personal'));
    expect(monthly).toHaveTextContent('All categories · Monthly');
    expect(monthly).toHaveTextContent('15 Sep – 14 Oct 2026');
    expect(monthly).toHaveTextContent('INR 100.00 spent of INR 400.00');
    expect(monthly).toHaveTextContent('INR 300.00 left');
    expect(monthly).toHaveTextContent('On track');
    expect(within(monthly).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(weekly).toHaveTextContent('Grocery · Weekly');
    expect(weekly).toHaveTextContent('Close to limit');
  });

  it('marks an over budget and shows how much it is over by, with a full bar', async () => {
    mockBudgets();
    renderApp('/');
    const [trips] = items(await group('Jha Household'));
    expect(trips).toHaveTextContent('Over budget');
    expect(trips).toHaveTextContent('Over by INR 250.50');
    expect(within(trips).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('offers Edit and Delete only on budgets the user can manage', async () => {
    mockBudgets();
    renderApp('/');
    const [mine] = items(await group('Jha Household'));
    expect(within(mine).getByRole('link', { name: 'Edit Trips · Yearly budget' }))
      .toHaveAttribute('href', '/budgets/3/edit');
    const [theirs] = items(await group('Trip Crew'));
    expect(within(theirs).queryByRole('link', { name: /Edit/ })).toBeNull();
    expect(within(theirs).queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('filters a group by period and by category', async () => {
    mockBudgets();
    const { user } = renderApp('/');
    const personal = await group('Personal');
    await user.selectOptions(within(personal).getByLabelText('Period'), 'Weekly');
    expect(items(personal)).toHaveLength(1);
    expect(items(personal)[0]).toHaveTextContent('Grocery · Weekly');
    await user.selectOptions(within(personal).getByLabelText('Period'), 'All periods');
    await user.selectOptions(within(personal).getByLabelText('Category'), 'All categories');
    expect(items(personal)).toHaveLength(1);
    expect(items(personal)[0]).toHaveTextContent('All categories · Monthly');
    await user.selectOptions(within(personal).getByLabelText('Category'), 'Trips');
    expect(within(personal).getByText('No budgets match')).toBeInTheDocument();
    expect(items(await group('Jha Household'))).toHaveLength(1);
  });

  it('deletes a budget only after confirmation, then reloads the list', async () => {
    let budgets = BUDGETS;
    const calls = mockBudgets(() => budgets);
    const { user } = renderApp('/');
    const [monthly] = items(await group('Personal'));
    await user.click(within(monthly).getByRole('button', { name: 'Delete All categories · Monthly budget' }));
    await user.click(await screen.findByRole('button', { name: 'Keep budget' }));
    expect(calls.deleted).toEqual([]);
    await user.click(within(monthly).getByRole('button', { name: 'Delete All categories · Monthly budget' }));
    budgets = BUDGETS.filter((b) => b.id !== 1);
    await user.click(await screen.findByRole('button', { name: 'Delete budget' }));
    expect(await screen.findByText('Budget deleted')).toBeInTheDocument();
    expect(calls.deleted).toEqual([1]);
    await waitFor(() => expect(items(screen.getByRole('region', { name: 'Personal budgets' }))).toHaveLength(1));
  });

  it('shows an error with Retry when budgets cannot be loaded', async () => {
    let fail = true;
    mockBudgets();
    server.use(http.get('/api/budgets', () => (fail
      ? HttpResponse.json({ detail: 'Bad request' }, { status: 400 }) : HttpResponse.json([]))));
    const { user } = renderApp('/');
    expect(await screen.findByText('Could not load your budgets.')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
  });

  it('shows new spending after an expense is added, without a page reload', async () => {
    let spent = '100.00';
    mockBudgets(() => [budget({ id: 1, spent, remaining: '0.00', status: spent === '100.00' ? 'on_track' : 'over', over_by: '50.00' })]);
    server.use(http.post('/api/expenses', () => {
      spent = '450.00';
      return HttpResponse.json({ id: 9, amount: '350.00', currency: 'INR', category: { id: 1, name: 'Grocery' } }, { status: 201 });
    }));
    const { user } = renderApp('/');
    expect(items(await group('Personal'))[0]).toHaveTextContent('INR 100.00 spent');
    await user.click(screen.getByRole('link', { name: 'Add expense' }));
    await user.type(await screen.findByLabelText('Amount'), '350');
    await user.selectOptions(screen.getByLabelText('Category'), 'Grocery');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(items(await group('Personal'))[0]).toHaveTextContent('INR 450.00 spent'));
  });
});
