import { expect, test } from '@playwright/test';
import { TEST_USER, expectDashboard, logIn, logOut } from './helpers.js';

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

test('login returns to the page asked for, with its query string', async ({ page }) => {
  await page.goto('/families?tab=mine');
  await expect(page).toHaveURL('/login');
  // Submit here: logIn() reopens /login, which would drop the remembered page.
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password);
  await loginButton(page).click();
  await expect(page).toHaveURL('/families?tab=mine');
  await expect(page.getByRole('heading', { name: 'Families' })).toBeVisible();
});

test('logout returns to login and the back button does not show the dashboard', async ({ page }) => {
  await logIn(page);
  await expectDashboard(page);
  // Login and logout replace their history entries. Open /login while logged in (redirected to the
  // dashboard) so history holds a dashboard page load for "back" to return to.
  await page.goto('/login');
  await expectDashboard(page);
  await logOut(page);
  await expect(page).toHaveURL('/login');

  await page.goBack();
  await expect(loginButton(page)).toBeVisible();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('heading', { name: /^Welcome,/ })).toHaveCount(0);

  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('a logout that fails to reach the server is finished on the next load', async ({ page }) => {
  await logIn(page);
  await expectDashboard(page);
  await page.route('**/api/auth/logout', (route) => route.abort('internetdisconnected'), { times: 1 });
  const failed = page.waitForEvent('requestfailed', (r) => r.url().endsWith('/api/auth/logout'));
  await page.getByRole('button', { name: TEST_USER.name }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await failed;
  await expect(page).toHaveURL('/login');

  const retried = page.waitForResponse((r) => r.url().endsWith('/api/auth/logout'));
  await page.reload();
  expect((await retried).status()).toBe(204);
  await expect(loginButton(page)).toBeVisible();
  await page.reload();
  await expect(loginButton(page)).toBeVisible();
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

test('the login form works with the keyboard alone', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  const focused = (locator) => expect(locator).toBeFocused();
  await page.keyboard.press('Tab');
  await focused(page.getByLabel('Email'));
  await page.keyboard.type(TEST_USER.email);
  await page.keyboard.press('Tab');
  await focused(page.getByLabel('Password', { exact: true }));
  await page.keyboard.type(TEST_USER.password);
  for (const name of ['Show password', 'Forgot password?', 'Log in']) {
    await page.keyboard.press('Tab');
    await focused(page.getByRole('button', { name }));
  }
  await page.getByLabel('Password', { exact: true }).press('Enter');
  await expectDashboard(page);
});

test('the favicon is the Expense Sarathi icon', async ({ page }) => {
  await page.goto('/login');
  const href = await page.locator('link[rel=icon]').getAttribute('href');
  expect(href).toBe('/logo-icon-light.svg');
  expect((await page.request.get(href)).ok()).toBe(true);
});
