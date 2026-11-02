import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

const FAMILIES = [{ id: 3, name: 'Jha Household', role: 'owner' }];
const MEMBERS = [
  { user_id: 1, display_name: 'Priya', email: 'priya@example.com', role: 'owner' },
  { user_id: 2, display_name: 'Ravi', email: 'ravi@example.com', role: 'member' },
];
const GROCERY = { id: 1, name: 'Grocery', color: '#8aa84a' };
const TRANSACTION = {
  id: 11, amount: '12.50', currency: 'AUD', category: GROCERY, spent_on: '2026-09-01',
  description: 'Weekly shop', family_id: null, deleted_at: null,
  created_by: { id: 1, display_name: 'Priya' }, created_at: '2026-09-01T10:00:00Z',
};
const ENTRY = {
  id: 21, action: 'updated', performed_by: { id: 2, display_name: 'Ravi' }, created_at: '2026-09-02T10:00:00Z',
  changes: { amount: ['12.50', '15.00'] },
  expense: { ...TRANSACTION, family_id: 3, deleted_at: '2026-09-03T10:00:00Z' },
};

/** Logged in with one family; each list request is answered by `list` / `audit` and recorded. */
function mockTransactions({ list = () => ({ items: [TRANSACTION], has_more: false }), audit } = {}) {
  const requests = [];
  const answer = (respond) => ({ request }) => {
    const params = new URL(request.url).searchParams;
    requests.push(params);
    return HttpResponse.json(respond(params));
  };
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json(FAMILIES)),
    http.get('/api/families/3', () => HttpResponse.json({ id: 3, name: 'Jha Household', members: MEMBERS })),
    http.get('/api/expenses', answer(list)),
    http.get('/api/expenses/audit-log', answer(audit ?? (() => ({ items: [ENTRY], has_more: false })))),
  );
  return requests;
}

const list = (name) => screen.findByRole('list', { name });

describe('Transactions', () => {
  it('lists personal transactions with who created them and when', async () => {
    mockTransactions();
    renderApp('/transactions');
    const row = within(await list('Transactions')).getByRole('link');
    expect(row).toHaveTextContent('Grocery');
    expect(row).toHaveTextContent('1 Sep 2026');
    expect(row).toHaveTextContent('Weekly shop');
    expect(row).toHaveTextContent('AUD 12.50');
    expect(row).toHaveTextContent('Created by Priya on');
    expect(row).toHaveAttribute('href', '/transactions/11');
  });

  it('switches to a family and filters by member', async () => {
    const requests = mockTransactions();
    const { user, router } = renderApp('/transactions');
    await list('Transactions');
    expect(screen.queryByLabelText('Created by')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Space'), 'Jha Household');
    await waitFor(() => expect(requests.at(-1).get('family_id')).toBe('3'));
    await user.selectOptions(await screen.findByLabelText('Created by'), 'Ravi');
    await waitFor(() => expect(requests.at(-1).get('user_id')).toBe('2'));
    expect(router.state.location.search).toBe('?space=3&member=2');
  });

  it('searches descriptions, filters categories and clears all filters', async () => {
    const requests = mockTransactions();
    const { user, router } = renderApp('/transactions');
    await list('Transactions');
    await user.type(screen.getByLabelText('Search descriptions'), 'milk{Enter}');
    await waitFor(() => expect(requests.at(-1).get('q')).toBe('milk'));
    await user.click(screen.getByRole('button', { name: 'Trips' }));
    await waitFor(() => expect(requests.at(-1).getAll('category_id')).toEqual(['3']));
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByLabelText('Search descriptions')).toHaveValue('');
  });

  it('keeps a search being typed when another filter changes', async () => {
    const requests = mockTransactions();
    const { user } = renderApp('/transactions');
    await list('Transactions');
    await user.type(screen.getByLabelText('Search descriptions'), 'milk');
    await user.click(screen.getByRole('button', { name: 'Trips' }));
    await waitFor(() => expect(requests.at(-1).getAll('category_id')).toEqual(['3']));
    expect(screen.getByLabelText('Search descriptions')).toHaveValue('milk');
  });

  it('pages with Previous and Next', async () => {
    const requests = mockTransactions({ list: (params) => ({ items: [TRANSACTION], has_more: params.get('offset') === '0' }) });
    const { user } = renderApp('/transactions');
    await list('Transactions');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(requests.at(-1).get('offset')).toBe('25'));
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('offers to add an expense when a space has none', async () => {
    mockTransactions({ list: () => ({ items: [], has_more: false }) });
    renderApp('/transactions');
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an expense' })).toHaveAttribute('href', '/expenses/new');
  });

  it('shows the audit log with actions, changes and deleted transactions', async () => {
    const requests = mockTransactions();
    const { user } = renderApp('/transactions?space=3');
    await list('Transactions');
    await user.click(screen.getByRole('tab', { name: 'Audit log' }));
    const entry = within(await list('Audit log')).getByRole('link');
    expect(entry).toHaveTextContent('Updated');
    expect(entry).toHaveTextContent('AUD 12.50 · Grocery');
    expect(entry).toHaveTextContent('Deleted');
    expect(entry).toHaveTextContent('By Ravi on');
    expect(entry).toHaveTextContent('Amount: 12.50');
    expect(entry).toHaveTextContent('15.00');
    expect(screen.getByLabelText('Performed by')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Deleted' }));
    await waitFor(() => expect(requests.at(-1).getAll('action')).toEqual(['deleted']));
  });

  it('shows the audit log empty state', async () => {
    mockTransactions({ audit: () => ({ items: [], has_more: false }) });
    renderApp('/transactions?view=audit');
    expect(await screen.findByText('No actions yet')).toBeInTheDocument();
  });
});
