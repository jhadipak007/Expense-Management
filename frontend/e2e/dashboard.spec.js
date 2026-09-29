import { expect, test } from '@playwright/test';
import { addExpense, createFamily, signUpFresh } from './dashboard-helpers.js';

const card = (page, name) => page.getByRole('region', { name });

/**
 * Filters are controlled by the URL, which updates just after the click, so
 * click and wait for the checked state rather than using check().
 */
async function choose(control) {
  await control.click();
  await expect(control).toBeChecked();
}

test('summaries follow expenses and filters', async ({ page }) => {
  await signUpFresh(page);
  const personal = card(page, 'Personal');
  await expect(personal.getByText('No expenses match these filters.')).toBeVisible();

  await addExpense(page, { amount: '42.50', category: 'Grocery' });
  await expect(personal.getByText('AUD 42.50').first()).toBeVisible();

  await createFamily(page, 'Asha Home');
  await addExpense(page, { amount: '1200', currency: 'INR', category: 'Trips', shareWith: 'Asha Home' });
  const family = card(page, 'Asha Home');
  await expect(family.getByText('INR 1,200.00').first()).toBeVisible();
  await expect(personal.getByText('INR 1,200.00')).toHaveCount(0);

  await choose(page.getByRole('checkbox', { name: 'Trips' }));
  await expect(personal.getByText('No expenses match these filters.')).toBeVisible();
  await expect(family.getByText('INR 1,200.00').first()).toBeVisible();

  await choose(page.getByRole('radio', { name: 'Last month' }));
  await expect(family.getByText('No expenses match these filters.')).toBeVisible();

  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByRole('radio', { name: 'This month' })).toBeChecked();
  await expect(personal.getByText('AUD 42.50').first()).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('filters survive adding an expense and reloading', async ({ page }) => {
  await signUpFresh(page);
  await choose(page.getByRole('checkbox', { name: 'Grocery' }));
  await expect(page).toHaveURL(/category=1/);
  await addExpense(page, { amount: '10', category: 'Grocery' });
  await expect(page).toHaveURL(/category=1/);
  await expect(page.getByRole('checkbox', { name: 'Grocery' })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Grocery' })).toBeChecked();
  await expect(card(page, 'Personal').getByText('AUD 10.00').first()).toBeVisible();
});
