import { expect } from '@playwright/test';
import { fillSignUp, submitCode } from './register-helpers.js';

/** Sign up a fresh user, so the dashboard shows only what this test adds. */
export async function signUpFresh(page) {
  await fillSignUp(page);
  await submitCode(page, '2211');
  await expect(page.getByRole('heading', { name: 'Welcome, Asha' })).toBeVisible();
}

export async function addExpense(page, { amount, currency = 'AUD', category, shareWith }) {
  await page.getByRole('link', { name: 'Add expense' }).click();
  await page.getByLabel('Amount').fill(amount);
  await page.getByLabel('Currency').fill(currency);
  await page.getByLabel('Category').selectOption(category);
  if (shareWith) await page.getByLabel('Share with').selectOption(shareWith);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Expense saved/)).toBeVisible();
}

export async function createFamily(page, name) {
  await page.goto('/families');
  await page.getByLabel('Family name').fill(name);
  await page.getByRole('button', { name: 'Create family' }).click();
  await expect(page.getByRole('link', { name })).toBeVisible();
  await page.goto('/');
}
