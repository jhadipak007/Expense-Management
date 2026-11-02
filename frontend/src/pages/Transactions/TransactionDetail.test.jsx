import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

const PRIYA = { id: 1, display_name: 'Priya' };
const CREATED = { id: 1, action: 'created', performed_by: PRIYA, created_at: '2026-09-01T10:00:00Z', changes: null };
const UPDATED = {
  id: 2, action: 'updated', performed_by: PRIYA, created_at: '2026-09-02T10:00:00Z',
  changes: { amount: ['10.00', '12.50'], description: [null, 'Weekly shop'] },
};
const DETAIL = {
  id: 11, amount: '12.50', currency: 'AUD', category: { id: 1, name: 'Grocery', color: '#8aa84a' },
  spent_on: '2026-09-01', description: 'Weekly shop', family_id: null, deleted_at: null,
  created_by: PRIYA, created_at: '2026-09-01T10:00:00Z',
  history: [CREATED, UPDATED], last_modified_by: PRIYA, last_modified_at: '2026-09-02T10:00:00Z', can_edit: true,
};

/** Logged in, viewing `detail`; records the body of each change request. */
function mockDetail(detail = DETAIL) {
  const calls = [];
  let current = detail;
  server.use(
    validRefresh,
    http.get('/api/expenses/11', () => HttpResponse.json(current)),
    http.patch('/api/expenses/11', async ({ request }) => {
      const body = await request.json();
      calls.push(['PATCH', body]);
      current = { ...current, ...body, category: current.category };
      return HttpResponse.json(current);
    }),
    http.delete('/api/expenses/11', () => {
      calls.push(['DELETE']);
      current = { ...current, deleted_at: '2026-09-03T10:00:00Z' };
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('/api/expenses/11/restore', () => {
      calls.push(['RESTORE']);
      current = { ...current, deleted_at: null };
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const fields = () => screen.getByRole('region', { name: 'Transaction' });

describe('Transaction detail', () => {
  it('shows the fields, who created and last changed it, and the history', async () => {
    mockDetail();
    renderApp('/transactions/11?space=3');
    expect(await screen.findByRole('heading', { level: 1, name: 'AUD 12.50' })).toBeInTheDocument();
    expect(fields()).toHaveTextContent('Date of expense1 Sep 2026');
    expect(fields()).toHaveTextContent('Shared withPersonal');
    expect(fields()).toHaveTextContent('Created byPriya');
    expect(fields()).toHaveTextContent('Last modified byPriya');
    const history = within(screen.getByRole('region', { name: 'History' })).getAllByRole('listitem');
    expect(history[0]).toHaveTextContent('Created');
    expect(history[1]).toHaveTextContent('Updated');
    expect(history[1]).toHaveTextContent('Description: None');
    expect(screen.getByRole('link', { name: 'Back to transactions' })).toHaveAttribute('href', '/transactions?space=3');
  });

  it('hides Edit and Delete from family members who did not record it', async () => {
    mockDetail({ ...DETAIL, can_edit: false, history: [CREATED], last_modified_by: null, last_modified_at: null });
    renderApp('/transactions/11');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(fields()).toHaveTextContent('Last modified byNot changed since created');
  });

  it('edits in place without sending the space', async () => {
    const calls = mockDetail();
    const { user } = renderApp('/transactions/11');
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/This cannot be changed/)).toBeInTheDocument();
    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls).toEqual([['PATCH', {
      amount: '20', currency: 'AUD', category_id: 1, spent_on: '2026-09-01', description: 'Weekly shop',
    }]]));
    expect(await screen.findByRole('heading', { level: 1, name: 'AUD 20.00' })).toBeInTheDocument();
  });

  it('deletes after confirmation, then restores', async () => {
    const calls = mockDetail();
    const { user } = renderApp('/transactions/11');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await within(fields()).findByText('Deleted')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(calls).toEqual([['DELETE'], ['RESTORE']]));
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('says when the transaction cannot be seen', async () => {
    server.use(validRefresh, http.get('/api/expenses/99', () => HttpResponse.json({ detail: 'Expense not found' }, { status: 404 })));
    renderApp('/transactions/99');
    expect(await screen.findByText('Transaction not found.')).toBeInTheDocument();
  });
});
