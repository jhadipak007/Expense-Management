import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

const FAMILIES = [
  { id: 3, name: 'Jha Household', role: 'owner' },
  { id: 4, name: 'Trip Crew', role: 'member' },
];

const BUDGET = {
  id: 7, family_id: 3, category_id: 1, period: 'monthly', amount: '400.00', currency: 'INR',
  period_start: '2026-10-15', period_end: '2026-11-14', spent: '0.00', remaining: '400.00',
  over_by: '0.00', status: 'on_track', can_manage: true,
};

/** Logged in, with fake families and budgets API; returns the requests sent as `[method, url, body]`. */
function mockBudgetsApi({ budget = BUDGET, response } = {}) {
  const sent = [];
  const reply = async ({ request }) => {
    const body = await request.json();
    sent.push([request.method, request.url, body]);
    if (response) return response();
    return HttpResponse.json({ ...BUDGET, family_id: null, category_id: null, ...body });
  };
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json(FAMILIES)),
    http.get('/api/budgets/:id', () => HttpResponse.json(budget)),
    http.post('/api/budgets', reply),
    http.patch('/api/budgets/:id', reply),
  );
  return sent;
}

const optionTexts = (select) => [...select.options].map((option) => option.textContent);
const save = () => screen.getByRole('button', { name: 'Save budget' });

async function fillRequired(user, amount = '250') {
  await user.selectOptions(await screen.findByLabelText('Category'), 'All categories');
  await user.selectOptions(screen.getByLabelText('Period'), 'Weekly');
  await user.type(screen.getByLabelText('Amount'), amount);
}

describe('Create budget', () => {
  it('opens from the dashboard', async () => {
    mockBudgetsApi();
    const { user } = renderApp('/');
    // The link appears after three chained loads (session, dashboard options, budgets).
    await user.click(await screen.findByRole('link', { name: 'Create budget' }, { timeout: 3000 }));
    expect(await screen.findByRole('heading', { name: 'Create budget' })).toBeInTheDocument();
  });

  it('offers Personal and only the families I own', async () => {
    mockBudgetsApi();
    renderApp('/budgets/new');
    expect(optionTexts(await screen.findByLabelText('Applies to'))).toEqual(['Personal', 'Jha Household']);
    expect(optionTexts(screen.getByLabelText('Category'))).toEqual([
      'Choose a category', 'All categories', 'Grocery', 'Eating Out', 'Trips',
    ]);
    expect(optionTexts(screen.getByLabelText('Period'))).toEqual([
      'Choose a period', 'Weekly', 'Fortnightly', 'Monthly', 'Yearly',
    ]);
    expect(screen.getByLabelText('Currency')).toHaveValue('AUD');
  });

  it('shows a message next to each missing field and saves nothing', async () => {
    const sent = mockBudgetsApi();
    const { user } = renderApp('/budgets/new');
    await user.click(await screen.findByRole('button', { name: 'Save budget' }));
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription('Choose a category, or All categories');
    expect(screen.getByLabelText('Period')).toHaveAccessibleDescription('Choose a period');
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      'Enter an amount greater than 0, with at most 2 decimal places',
    );
    expect(sent).toHaveLength(0);
  });

  it.each(['0', '-5', 'abc', '1.234'])('rejects the amount %s', async (amount) => {
    const sent = mockBudgetsApi();
    const { user } = renderApp('/budgets/new');
    await fillRequired(user, amount);
    await user.click(save());
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      'Enter an amount greater than 0, with at most 2 decimal places',
    );
    expect(sent).toHaveLength(0);
  });

  it('saves the budget with today, then returns to the dashboard with a toast', async () => {
    const sent = mockBudgetsApi();
    const { user, router } = renderApp('/budgets/new');
    await user.selectOptions(await screen.findByLabelText('Applies to'), 'Jha Household');
    await user.selectOptions(screen.getByLabelText('Category'), 'Grocery');
    await user.selectOptions(screen.getByLabelText('Period'), 'Monthly');
    await user.type(screen.getByLabelText('Amount'), '400');
    await user.selectOptions(screen.getByLabelText('Currency'), 'INR');
    await user.click(save());
    expect(await screen.findByText('Budget saved')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    const [[method, url, body]] = sent;
    expect([method, new URL(url).searchParams.has('today')]).toEqual(['POST', true]);
    expect(body).toEqual({ family_id: 3, category_id: 1, period: 'monthly', amount: '400', currency: 'INR' });
  });

  it('sends All categories and Personal as null', async () => {
    const sent = mockBudgetsApi();
    const { user } = renderApp('/budgets/new');
    await fillRequired(user);
    await user.click(save());
    await screen.findByText('Budget saved');
    expect(sent[0][2]).toMatchObject({ family_id: null, category_id: null });
  });

  it('shows a duplicate budget message and keeps the input', async () => {
    mockBudgetsApi({
      response: () => HttpResponse.json(
        { detail: 'A budget for this scope, category, period and currency already exists' },
        { status: 409 },
      ),
    });
    const { user } = renderApp('/budgets/new');
    await fillRequired(user);
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A budget for this scope, category, period and currency already exists.',
    );
    expect(screen.getByLabelText('Amount')).toHaveValue('250');
    expect(save()).toBeEnabled();
  });

  it('shows a server field error next to the field', async () => {
    mockBudgetsApi({
      response: () => HttpResponse.json(
        { detail: [{ loc: ['body', 'currency'], msg: 'Unknown currency' }] }, { status: 422 },
      ),
    });
    const { user } = renderApp('/budgets/new');
    await fillRequired(user);
    await user.click(save());
    expect(await screen.findByLabelText('Currency')).toHaveAccessibleDescription('Choose a currency from the list');
  });
});

describe('Edit budget', () => {
  it('changes only the amount and period', async () => {
    const sent = mockBudgetsApi();
    const { user } = renderApp('/budgets/7/edit');
    expect(await screen.findByRole('heading', { name: 'Edit budget' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Applies to')).toBeDisabled();
    expect(screen.getByLabelText('Applies to')).toHaveDisplayValue('Jha Household');
    expect(screen.getByLabelText('Category')).toBeDisabled();
    expect(screen.getByLabelText('Currency')).toBeDisabled();
    expect(screen.getByLabelText('Period')).toHaveValue('monthly');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '300');
    await user.selectOptions(screen.getByLabelText('Period'), 'Fortnightly');
    await user.click(save());
    await screen.findByText('Budget saved');
    expect(sent[0][0]).toBe('PATCH');
    expect(sent[0][2]).toEqual({ amount: '300', period: 'fortnightly' });
  });

  it('tells a family member that only the owner can change it', async () => {
    mockBudgetsApi({ budget: { ...BUDGET, can_manage: false } });
    renderApp('/budgets/7/edit');
    const card = await screen.findByRole('heading', { name: 'Edit budget' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the family owner can change this budget.');
    expect(within(card.closest('section')).queryByRole('button', { name: 'Save budget' })).toBeNull();
  });
});
