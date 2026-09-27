import { expect, test } from '@playwright/test';
import { expectDashboard, logIn } from './helpers.js';

const loginButton = (page) => page.getByRole('button', { name: 'Log in' });

test('a logged-out visitor is sent to login from any page', async ({ page }) => {
  for (const path of ['/', '/reports']) {
    await page.goto(path);
    await expect(page).toHaveURL('/login');
    await expect(loginButton(page)).toBeVisible();
  }
});

test('empty fields say which one is required', async ({ page }) => {
  await page.goto('/login');
  await loginButton(page).click();
  await expect(page.getByText('Email is required')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();
});

test('wrong details keep the user on login with one message', async ({ page }) => {
  await logIn(page, { password: 'wrong-password' });
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');
  await logIn(page, { email: 'nobody@example.com' });
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');
  await expect(page).toHaveURL('/login');
});

test('login shows the dashboard greeting', async ({ page }) => {
  await logIn(page);
  await expectDashboard(page);
});

test('logout returns to login and the back button does not show the dashboard', async ({ page }) => {
  await logIn(page);
  await expectDashboard(page);
  // Login and logout replace their history entries. Open /login while logged in (redirected to the
  // dashboard) so history holds a dashboard page load for "back" to return to.
  await page.goto('/login');
  await expectDashboard(page);
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL('/login');

  await page.goBack();
  await expect(loginButton(page)).toBeVisible();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: /Welcome/ })).toHaveCount(0);

  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('a returning user goes straight to the dashboard', async ({ page, context }) => {
  await logIn(page);
  await expectDashboard(page);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expectDashboard(reopened);
});

test('the refresh cookie is HttpOnly and scoped to /api/auth', async ({ page, context }) => {
  await logIn(page);
  await expectDashboard(page);
  const [cookie] = (await context.cookies()).filter((c) => c.name === 'refresh_token');
  expect(cookie).toMatchObject({ httpOnly: true, path: '/api/auth', sameSite: 'Strict' });
  expect(await page.evaluate(() => document.cookie)).not.toContain('refresh_token');
});
