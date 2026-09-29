import { expect } from '@playwright/test';

/** Seeded local test user (backend/app/seed.py). */
export const TEST_USER = { email: 'test@gmail.com', password: 'P@ssw0rd', name: 'Test User' };

export async function logIn(page, { email = TEST_USER.email, password = TEST_USER.password } = {}) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

export async function expectDashboard(page) {
  await expect(page.getByRole('heading', { name: `Welcome, ${TEST_USER.name}` })).toBeVisible();
  await expect(page.getByRole('button', { name: TEST_USER.name })).toBeVisible();
  await expect(page).toHaveURL('/');
}

/**
 * Log out through the user menu and wait for the server; navigating first would abort the
 * request and keep the session.
 */
export async function logOut(page, name = TEST_USER.name) {
  const loggedOut = page.waitForResponse((r) => r.url().endsWith('/api/auth/logout'));
  await page.getByRole('button', { name }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await loggedOut;
}

/** A family the test user owns, created only the first time so reruns don't pile up families. */
export async function ensureFamily(page, name) {
  await page.goto('/families');
  await expect(page.getByRole('heading', { name: 'Families' })).toBeVisible();
  await expect(page.getByText('Loading...')).toHaveCount(0);
  if (await page.getByRole('link', { name, exact: true }).count() === 0) {
    await page.getByLabel('Family name').fill(name);
    await page.getByRole('button', { name: 'Create family' }).click();
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
  return name;
}
