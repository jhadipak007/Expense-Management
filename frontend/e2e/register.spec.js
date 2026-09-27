import { expect, test } from '@playwright/test';
import { TEST_USER, logIn } from './helpers.js';
import { fillSignUp, newEmail, submitCode } from './register-helpers.js';

test('sign up with the OTP, log out, and log back in', async ({ page }) => {
  const email = newEmail();
  await fillSignUp(page, { name: 'Asha', email });
  await submitCode(page, '2211');
  await expect(page.getByRole('heading', { name: 'Welcome, Asha' })).toBeVisible();
  await expect(page).toHaveURL('/');

  // Wait for logout to reach the server; navigating first would abort it and keep the session.
  const loggedOut = page.waitForResponse((r) => r.url().endsWith('/api/auth/logout'));
  await page.getByRole('button', { name: 'Logout' }).click();
  await loggedOut;
  await logIn(page, { email, password: 'longenough' });
  await expect(page.getByRole('heading', { name: 'Welcome, Asha' })).toBeVisible();
});

test('a wrong code keeps the visitor on the OTP screen', async ({ page }) => {
  await fillSignUp(page);
  await submitCode(page, '1234');
  await expect(page.getByRole('alert')).toHaveText('Incorrect code, please try again');
  await expect(page.getByLabel('Code')).toBeVisible();
});

test('five wrong codes return the visitor to the start of sign-up', async ({ page }) => {
  await fillSignUp(page);
  for (let attempt = 0; attempt < 5; attempt++) await submitCode(page, '0000');
  await expect(page.getByRole('alert')).toContainText('Please sign up again');
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible();
});

test('an abandoned sign-up creates no account and the email can be reused', async ({ page }) => {
  const email = newEmail();
  await fillSignUp(page, { email });
  await page.getByRole('button', { name: 'Back' }).click();
  await logIn(page, { email, password: 'longenough' });
  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password');

  await fillSignUp(page, { email });
  await submitCode(page, '2211');
  await expect(page).toHaveURL('/');
});

test('an existing email is refused with a link to log in', async ({ page }) => {
  await fillSignUp(page, { email: TEST_USER.email.toUpperCase() });
  await expect(page.getByRole('alert')).toContainText('An account with this email already exists');
  await page.getByRole('alert').getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL('/login');
});
