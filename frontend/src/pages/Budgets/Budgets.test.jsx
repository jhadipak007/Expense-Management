import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

const BUDGET = {
  id: 7, family_id: null, category_id: null, period: 'monthly', amount: '400.00', currency: 'INR',
  period_start: '2026-10-15', period_end: '2026-11-14', spent: '100.00', remaining: '300.00',
  over_by: '0.00', status: 'on_track', can_manage: true,
};

/** Logged in with one family, one personal and one family budget; saving returns BUDGET. */
function mockBudgets() {
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json([{ id: 3, name: 'Jha Household', role: 'owner' }])),
    http.get('/api/budgets', () => HttpResponse.json([BUDGET, { ...BUDGET, id: 8, family_id: 3 }])),
    http.get('/api/budgets/:id', () => HttpResponse.json(BUDGET)),
    http.post('/api/budgets', () => HttpResponse.json(BUDGET)),
    http.patch('/api/budgets/:id', () => HttpResponse.json(BUDGET)),
  );
}

describe('Budgets page', () => {
  it('lists personal and family budgets under a page title', async () => {
    mockBudgets();
    renderApp('/budgets');
    expect(await screen.findByRole('heading', { level: 1, name: 'Budgets' }, { timeout: 3000 })).toBeInTheDocument();
    const personal = await screen.findByRole('region', { name: 'Personal budgets' });
    expect(within(personal).getByRole('listitem')).toHaveTextContent('INR 300.00 left');
    expect(screen.getByRole('region', { name: 'Jha Household budgets' })).toBeInTheDocument();
  });

  it('returns to the Budgets page after creating a budget from it', async () => {
    mockBudgets();
    const { user, router } = renderApp('/budgets');
    await user.click(await screen.findByRole('link', { name: 'Create budget' }, { timeout: 3000 }));
    expect(await screen.findByRole('link', { name: 'Back to budgets' })).toHaveAttribute('href', '/budgets');
    await user.selectOptions(await screen.findByLabelText('Category'), 'All categories');
    await user.selectOptions(screen.getByLabelText('Period'), 'Monthly');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.click(screen.getByRole('button', { name: 'Save budget' }));
    await screen.findByRole('heading', { level: 1, name: 'Budgets' });
    expect(router.state.location.pathname).toBe('/budgets');
  });

  it('returns to the Budgets page when leaving Edit budget', async () => {
    mockBudgets();
    const { user, router } = renderApp('/budgets');
    const personal = await screen.findByRole('region', { name: 'Personal budgets' }, { timeout: 3000 });
    await user.click(within(personal).getByRole('link', { name: /^Edit/ }));
    await user.click(await screen.findByRole('link', { name: 'Back to budgets' }));
    expect(router.state.location.pathname).toBe('/budgets');
  });
});
