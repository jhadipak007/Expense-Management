import { expect, test } from '@playwright/test';

test('API responses carry a request id', async ({ page }) => {
  const response = await page.request.get('/api/categories');
  expect(response.headers()['x-request-id']).toMatch(/^[0-9a-f]{32}$/);
});

test('an uncaught browser error is posted to the server log', async ({ page }) => {
  // The CSP must allow the post (connect-src); the login page's existing inline-style
  // CSP messages are unrelated.
  const blockedConnects = [];
  page.on('console', (message) => {
    if (message.text().includes('Refused to connect')) blockedConnects.push(message.text());
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();

  const posted = page.waitForResponse('/api/client-logs');
  await page.evaluate(() => setTimeout(() => {
    throw new Error('e2e uncaught error');
  }));
  const response = await posted;

  expect(response.status()).toBe(204);
  const [entry] = response.request().postDataJSON().entries;
  expect(entry).toMatchObject({ message: expect.stringContaining('e2e uncaught error'),
    url: '/login' });
  expect(blockedConnects).toEqual([]);
});
