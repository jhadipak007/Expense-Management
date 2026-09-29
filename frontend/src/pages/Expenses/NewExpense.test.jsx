import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '../../test/handlers.js';
import { server } from '../../test/setup.js';
import { renderApp } from '../../test/renderApp.jsx';
import { todayIso } from '../../utils/format.js';

const FAMILIES = [
  { id: 3, name: 'Jha Household', role: 'owner' },
  { id: 4, name: 'Trip Crew', role: 'member' },
];

/** Logged in, with fake families and expenses API; returns the bodies POSTed. */
function mockExpensesApi({ families = FAMILIES, response } = {}) {
  const posted = [];
  server.use(
    validRefresh,
    http.get('/api/families', () => HttpResponse.json(families)),
    http.post('/api/expenses', async ({ request }) => {
      const body = await request.json();
      posted.push(body);
      if (response) return response();
      return HttpResponse.json(
        { id: 1, user_id: 1, ...body, category: { id: 1, name: 'Grocery', color: '#8aa84a' } },
        { status: 201 },
      );
    }),
  );
  return posted;
}

async function fillRequired(user, amount = '12.50') {
  await user.type(await screen.findByLabelText('Amount'), amount);
  await user.selectOptions(screen.getByLabelText('Category'), 'Grocery');
}

const save = () => screen.getByRole('button', { name: 'Save' });

describe('Add expense', () => {
  it('opens from the dashboard', async () => {
    mockExpensesApi();
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Add expense' }));
    expect(await screen.findByRole('heading', { name: 'Add expense' })).toBeInTheDocument();
  });

  it('sends a logged-out visitor to the login page', async () => {
    renderApp('/expenses/new');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('defaults to AUD, today and Personal, with categories from the server', async () => {
    mockExpensesApi();
    renderApp('/expenses/new');
    expect(await screen.findByLabelText('Currency')).toHaveValue('AUD');
    expect(screen.getByLabelText('Date')).toHaveValue(todayIso());
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', todayIso());
    expect(screen.getByLabelText('Share with')).toHaveDisplayValue('Personal');
    const category = screen.getByLabelText('Category');
    const options = [...category.options].map((option) => option.textContent);
    expect(options).toEqual(['Choose a category', 'Grocery', 'Eating Out', 'Trips']);
  });

  it('offers only my families to share with', async () => {
    mockExpensesApi();
    renderApp('/expenses/new');
    const shareWith = await screen.findByLabelText('Share with');
    const options = [...shareWith.options].map((option) => option.textContent);
    expect(options).toEqual(['Personal', 'Jha Household', 'Trip Crew']);
  });

  it('offers only Personal when I have no families', async () => {
    mockExpensesApi({ families: [] });
    renderApp('/expenses/new');
    const shareWith = await screen.findByLabelText('Share with');
    expect([...shareWith.options].map((option) => option.textContent)).toEqual(['Personal']);
  });

  it('keeps Save disabled until the required fields are filled', async () => {
    mockExpensesApi();
    const { user } = renderApp('/expenses/new');
    await user.type(await screen.findByLabelText('Amount'), '5');
    expect(save()).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Category'), 'Trips');
    expect(save()).toBeEnabled();
    await user.clear(screen.getByLabelText('Currency'));
    expect(save()).toBeDisabled();
  });

  it.each(['0', '-5', 'abc', '1.234'])('rejects the amount %s without saving', async (amount) => {
    const posted = mockExpensesApi();
    const { user } = renderApp('/expenses/new');
    await fillRequired(user, amount);
    await user.click(save());
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      'Enter an amount greater than 0, with at most 2 decimal places',
    );
    expect(posted).toHaveLength(0);
  });

  it('upper-cases the currency and rejects codes that are not 3 letters', async () => {
    const posted = mockExpensesApi();
    const { user } = renderApp('/expenses/new');
    await fillRequired(user);
    await user.clear(screen.getByLabelText('Currency'));
    await user.type(screen.getByLabelText('Currency'), 'us');
    expect(screen.getByLabelText('Currency')).toHaveValue('US');
    await user.click(save());
    expect(screen.getByLabelText('Currency')).toHaveAccessibleDescription(
      'Enter a 3-letter currency code, such as AUD',
    );
    expect(posted).toHaveLength(0);
  });

  it('saves a family expense and confirms it on the dashboard', async () => {
    const posted = mockExpensesApi();
    const { user, router } = renderApp('/expenses/new');
    await fillRequired(user, '1999.9');
    await user.clear(screen.getByLabelText('Currency'));
    await user.type(screen.getByLabelText('Currency'), 'inr');
    await user.type(screen.getByLabelText('Description (optional)'), '  Weekly shop ');
    await user.selectOptions(screen.getByLabelText('Share with'), 'Trip Crew');
    await user.click(save());
    expect(await screen.findByText('Expense saved: 1999.9 INR for Grocery.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(posted).toEqual([{
      amount: '1999.9', currency: 'INR', category_id: 1, spent_on: todayIso(),
      description: 'Weekly shop', family_id: 4,
    }]);
  });

  it('saves a personal expense without a family', async () => {
    const posted = mockExpensesApi();
    const { user } = renderApp('/expenses/new');
    await fillRequired(user);
    await user.click(save());
    await screen.findByText(/Expense saved/);
    expect(posted[0]).toMatchObject({ family_id: null, description: null });
  });

  it('shows server validation errors next to the field and keeps the input', async () => {
    mockExpensesApi({
      response: () => HttpResponse.json(
        { detail: [{ loc: ['body', 'spent_on'], msg: 'Date cannot be in the future' }] },
        { status: 422 },
      ),
    });
    const { user } = renderApp('/expenses/new');
    await fillRequired(user, '42');
    await user.click(save());
    expect(await screen.findByLabelText('Date')).toHaveAccessibleDescription(
      'Enter a date that is not in the future',
    );
    expect(screen.getByLabelText('Amount')).toHaveValue('42');
    expect(save()).toBeEnabled();
  });

  it('asks to check the form when a server error matches no field', async () => {
    mockExpensesApi({
      response: () => HttpResponse.json(
        { detail: [{ loc: ['body'], msg: 'Invalid body' }] }, { status: 422 },
      ),
    });
    const { user } = renderApp('/expenses/new');
    await fillRequired(user);
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Please check the form and try again.');
  });

  it('explains when the family is no longer available', async () => {
    mockExpensesApi({
      response: () => HttpResponse.json({ detail: 'Family not found' }, { status: 404 }),
    });
    const { user } = renderApp('/expenses/new');
    await fillRequired(user);
    await user.selectOptions(screen.getByLabelText('Share with'), 'Jha Household');
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Family not found. Choose Personal or one of your families.',
    );
  });

  it('shows a spinner and blocks a second submit while saving', async () => {
    let release;
    const posted = mockExpensesApi({
      response: () => new Promise((resolve) => {
        release = () => resolve(HttpResponse.json({ detail: 'x' }, { status: 500 }));
      }),
    });
    const { user } = renderApp('/expenses/new');
    await fillRequired(user);
    await user.click(save());
    const saving = await screen.findByRole('button', { name: 'Saving...' });
    expect(saving).toBeDisabled();
    await user.click(saving);
    await waitFor(() => expect(release).toBeDefined());
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(posted).toHaveLength(1);
  });
});
