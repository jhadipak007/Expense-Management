import { expect, test } from '@playwright/test';
import { expectDashboard, logIn } from './helpers.js';

async function openForm(page) {
  await logIn(page);
  await expectDashboard(page);
  await page.getByRole('link', { name: 'Add expense' }).click();
  await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
}

test('add a personal expense from the dashboard', async ({ page }) => {
  await openForm(page);
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Amount').fill('0');
  await page.getByLabel('Category').selectOption('Grocery');
  await save.click();
  await expect(page.getByText('Enter an amount greater than 0')).toBeVisible();
  await page.getByLabel('Amount').fill('42.50');
  await page.getByLabel('Description (optional)').fill('Weekly shop');
  await save.click();
  await expect(page.getByRole('status')).toHaveText('Expense saved: 42.50 AUD for Grocery.');
  await expect(page).toHaveURL('/');
});

test('share an expense with a family', async ({ page }) => {
  await logIn(page);
  await expectDashboard(page);
  const family = `Family ${Date.now()}`;
  await page.goto('/families');
  await page.getByLabel('Family name').fill(family);
  await page.getByRole('button', { name: 'Create family' }).click();
  await expect(page.getByRole('link', { name: family })).toBeVisible();

  await page.goto('/expenses/new');
  await page.getByLabel('Amount').fill('120');
  await page.getByLabel('Currency').fill('usd');
  await page.getByLabel('Category').selectOption('Trips');
  await page.getByRole('radio', { name: family }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Expense saved: 120.00 USD for Trips.');
});

test('a logged-out visitor is sent to the login page', async ({ page }) => {
  await page.goto('/expenses/new');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
