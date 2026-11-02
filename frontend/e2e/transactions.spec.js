import { expect, test } from '@playwright/test';
import { addExpense, signUpFresh } from './dashboard-helpers.js';

test('a transaction is listed, edited, deleted and restored, and every action is audited', async ({ page }) => {
  await signUpFresh(page);
  await addExpense(page, { amount: '42.50', category: 'Grocery' });
  // Every full page load already logs two inline-style CSP messages; only watch from here.
  const cspErrors = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) cspErrors.push(message.text());
  });

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Transactions' }).click();
  const list = page.getByRole('list', { name: 'Transactions' });
  await expect(list.getByRole('link')).toHaveCount(1);
  await expect(list).toContainText('AUD 42.50');
  await expect(list).toContainText('Created by Asha');

  await list.getByRole('link').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Amount').fill('50');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AUD 50.00' })).toBeVisible();
  const history = page.getByRole('region', { name: 'History' });
  await expect(history).toContainText('Amount: 42.50');

  expect(cspErrors).toEqual([]);

  // The confirmation dialog's scroll lock logs one known, accepted CSP message (see frontend.md).
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  expect(cspErrors).toHaveLength(1);
  cspErrors.length = 0;
  await page.getByRole('link', { name: 'Back to transactions' }).click();
  await expect(page.getByText('No transactions yet')).toBeVisible();

  await page.getByRole('tab', { name: 'Audit log' }).click();
  const audit = page.getByRole('list', { name: 'Audit log' });
  await expect(audit.getByRole('link')).toHaveCount(3);
  await expect(audit.getByRole('link').first()).toContainText('Deleted');

  await audit.getByRole('link').first().click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(history.locator('ol > li')).toHaveCount(4);
  await expect(history.locator('ol > li').last()).toContainText('Restored');
  expect(cspErrors).toEqual([]);
});

test('filters stay in the URL after a reload, and Clear all removes them', async ({ page }) => {
  await signUpFresh(page);
  await addExpense(page, { amount: '10', category: 'Trips' });
  await page.goto('/transactions');
  await page.getByLabel('Search descriptions').fill('nothing like this');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('No transactions match these filters')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Search descriptions')).toHaveValue('nothing like this');
  await expect(page.getByText('No transactions match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(page.getByRole('list', { name: 'Transactions' })).toContainText('AUD 10.00');
});
