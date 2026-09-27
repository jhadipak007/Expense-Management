/** A unique email per call so sign-up tests can run again against the same database. */
export function newEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function fillSignUp(page, { name = 'Asha', email = newEmail(), password = 'longenough' } = {}) {
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Sign up' }).click();
}

/** Submit the code and wait for the server's answer, which clears the input on failure. */
export async function submitCode(page, code) {
  await page.getByLabel('Code').fill(code);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/register/verify'));
  await page.getByRole('button', { name: 'Verify' }).click();
  await response;
}
