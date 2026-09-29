import { expect, test } from '@playwright/test';
import { ensureFamily, expectDashboard, logIn } from './helpers.js';

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
  await expect(page.getByText('Expense saved: 42.50 AUD for Grocery.')).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('share an expense with a family', async ({ page }) => {
  await logIn(page);
  await expectDashboard(page);
  const family = await ensureFamily(page, 'E2E Expenses');

  await page.goto('/expenses/new');
  await page.getByLabel('Amount').fill('120');
  await page.getByLabel('Currency').selectOption('USD');
  await page.getByLabel('Category').selectOption('Trips');
  await page.getByLabel('Share with').selectOption(family);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Expense saved: 120.00 USD for Trips.')).toBeVisible();
});

test('pick a currency with the keyboard and save in it', async ({ page }) => {
  await openForm(page);
  const currency = page.getByLabel('Currency');
  await expect(currency).toHaveValue('AUD');
  await expect(currency.locator('option')).toHaveCount(155);
  await currency.focus();
  await page.keyboard.type('US');
  await expect(currency).toHaveValue('USD');
  await page.getByLabel('Amount').fill('7.25');
  await page.getByLabel('Category').selectOption('Eating Out');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Expense saved: 7.25 USD for Eating Out.')).toBeVisible();
});

test('a logged-out visitor is sent to the login page', async ({ page }) => {
  await page.goto('/expenses/new');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
