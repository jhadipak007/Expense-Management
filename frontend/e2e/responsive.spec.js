import { expect, test } from '@playwright/test';
import { expectDashboard, logIn } from './helpers.js';

const WIDTHS = [360, 768, 1440];

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

async function expectTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
}

for (const width of WIDTHS) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('login page fits and has large touch targets', async ({ page }) => {
      await page.goto('/login');
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Log in' }));
      await expectTouchTarget(page.getByLabel('Email'));
      await page.screenshot({ path: `test-results/screens/login-${width}.png`, fullPage: true });
    });

    test('dashboard fits and shows Logout', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Logout' }));
      await page.screenshot({ path: `test-results/screens/dashboard-${width}.png`, fullPage: true });
    });
  });
}
