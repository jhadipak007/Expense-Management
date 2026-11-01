import { expect, test } from '@playwright/test';
import { addExpense, createFamily, signUpFresh } from './dashboard-helpers.js';

const group = (page, name) => page.getByRole('region', { name: `${name} budgets` });

async function createBudget(page, { appliesTo, category, period, amount, currency = 'AUD' }) {
  await page.getByRole('link', { name: 'Create budget' }).click();
  if (appliesTo) await page.getByLabel('Applies to').selectOption(appliesTo);
  await page.getByLabel('Category').selectOption(category);
  await page.getByLabel('Period').selectOption(period);
  await page.getByLabel('Amount').fill(amount);
  await page.getByLabel('Currency').selectOption(currency);
  await page.getByRole('button', { name: 'Save budget' }).click();
}

test('a personal budget tracks spending, warns, and can be edited and deleted', async ({ page }) => {
  await signUpFresh(page);
  // Every full page load already logs two inline-style CSP messages; only watch from here,
  // where pages change without a reload, so the progress bars are checked on their own.
  const cspErrors = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) cspErrors.push(message.text());
  });
  await expect(page.getByText('No budgets yet')).toBeVisible();

  await createBudget(page, { category: 'All categories', period: 'Monthly', amount: '100' });
  await expect(page.getByText('Budget saved')).toBeVisible();
  const personal = group(page, 'Personal');
  const item = personal.getByRole('listitem');
  await expect(item).toContainText('All categories · Monthly');
  await expect(item).toContainText('On track');
  await expect(item).toContainText('AUD 100.00 left');

  await addExpense(page, { amount: '85', category: 'Grocery' });
  await expect(item).toContainText('Close to limit');
  await expect(item).toContainText('AUD 85.00 spent of AUD 100.00');
  await addExpense(page, { amount: '30', category: 'Trips' });
  await expect(item).toContainText('Over budget');
  await expect(item).toContainText('Over by AUD 15.00');
  await expect(item.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(cspErrors).toEqual([]);

  await createBudget(page, { category: 'All categories', period: 'Monthly', amount: '50' });
  await expect(page.getByRole('alert')).toContainText('already exists');
  await page.getByRole('link', { name: 'Back to dashboard' }).click();

  await item.getByRole('link', { name: /^Edit/ }).click();
  await page.getByLabel('Amount').fill('200');
  await page.getByRole('button', { name: 'Save budget' }).click();
  await expect(item).toContainText('On track');
  await expect(item).toContainText('AUD 85.00 left');

  await item.getByRole('button', { name: /^Delete/ }).click();
  await page.getByRole('button', { name: 'Delete budget' }).click();
  await expect(page.getByText('No budgets yet')).toBeVisible();
});

test('the month start day from Settings applies to budgets and the dashboard', async ({ page }) => {
  await signUpFresh(page);
  await createBudget(page, { category: 'Grocery', period: 'Monthly', amount: '100' });
  const item = group(page, 'Personal').getByRole('listitem');
  await expect(item).toContainText(/^Grocery · Monthly1 \w{3} – /);
  const dashboardLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' });

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Month start day').selectOption('15th');
  await expect(page.getByText('Your month runs from the 15th to the 14th of the next month.')).toBeVisible();
  await dashboardLink.click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page).toHaveURL('/settings');

  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  // In-app navigation, no reload: the saved day must already be in the session.
  await dashboardLink.click();
  await expect(page.getByRole('radio', { name: 'This month' })).toBeChecked();
  await expect(page.getByText(/^15 \w{3}( \d{4})? – 14 \w{3} \d{4} · All categories$/)).toBeVisible();
  await expect(item).toContainText(/^Grocery · Monthly15 \w{3} – 14 \w{3}/);
});

test('a family budget is grouped under the family name', async ({ page }) => {
  await signUpFresh(page);
  await createFamily(page, 'Asha Home');
  await createBudget(page, {
    appliesTo: 'Asha Home', category: 'Trips', period: 'Weekly', amount: '500', currency: 'INR',
  });
  await addExpense(page, { amount: '120', currency: 'INR', category: 'Trips', shareWith: 'Asha Home' });
  await addExpense(page, { amount: '999', currency: 'INR', category: 'Trips' });
  const item = group(page, 'Asha Home').getByRole('listitem');
  await expect(item).toContainText('INR 120.00 spent of INR 500.00');
  await expect(group(page, 'Personal')).toHaveCount(0);
});

test('budgets stack in one column on a phone with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signUpFresh(page);
  await createBudget(page, { category: 'Grocery', period: 'Weekly', amount: '100' });
  await createBudget(page, { category: 'Trips', period: 'Yearly', amount: '900' });
  const items = group(page, 'Personal').getByRole('listitem');
  await expect(items).toHaveCount(2);
  const [first, second] = await items.all();
  const [a, b] = [await first.boundingBox(), await second.boundingBox()];
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(first.getByRole('link', { name: /^Edit/ })).toBeVisible();
  await expect(first.getByRole('button', { name: /^Delete/ })).toBeVisible();
});
