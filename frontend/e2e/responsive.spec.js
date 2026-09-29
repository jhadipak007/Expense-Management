import { expect, test } from '@playwright/test';
import { expectDashboard, logIn } from './helpers.js';
import { fillSignUp } from './register-helpers.js';

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
      await expectTouchTarget(page.getByRole('button', { name: 'Show password' }));
      await expectTouchTarget(page.getByRole('button', { name: 'Forgot password?' }));
      await expect(page.getByRole('img', { name: 'Expense Sarathi' })).toBeVisible();
      const highlight = page.getByText('Share expenses and reports with your family');
      await expect(highlight).toBeVisible({ visible: width >= 1024 });
      await page.screenshot({ path: `test-results/screens/login-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Forgot password?' }).click();
      await expect(page.getByRole('status')).toHaveText('Password reset is coming soon.');
      await expectNoHorizontalScroll(page);
    });

    test('sign-up and OTP screens fit and have large touch targets', async ({ page }) => {
      await fillSignUp(page);
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByLabel('Code'));
      await expectTouchTarget(page.getByRole('button', { name: 'Back' }));
      await page.screenshot({ path: `test-results/screens/otp-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Back' }).click();
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Sign up' }));
      await page.screenshot({ path: `test-results/screens/register-${width}.png`, fullPage: true });
    });

    test('dashboard fits and shows Logout', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Logout' }));
      await page.screenshot({ path: `test-results/screens/dashboard-${width}.png`, fullPage: true });
    });

    test('add expense form fits and has large touch targets', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      await page.getByRole('link', { name: 'Add expense' }).click();
      await expectTouchTarget(page.getByLabel('Amount'));
      await expectTouchTarget(page.getByLabel('Category'));
      await expectTouchTarget(page.getByLabel('Date'));
      await expectTouchTarget(page.getByRole('radio', { name: 'Personal' }).locator('..'));
      await expectTouchTarget(page.getByRole('button', { name: 'Save' }));
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `test-results/screens/add-expense-${width}.png`, fullPage: true });
    });

    test('navigation is a drawer below 1024px and a sidebar above', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      const menu = page.getByRole('button', { name: 'Menu' });
      const families = page.getByRole('link', { name: 'Families' });
      if (width < 1024) {
        await expect(families).toBeHidden();
        await expectTouchTarget(menu);
        await menu.click();
        await expect(families).toBeVisible();
        await expectNoHorizontalScroll(page);
        await page.screenshot({ path: `test-results/screens/drawer-${width}.png`, animations: 'disabled' });
      } else {
        await expect(menu).toBeHidden();
        await expect(families).toBeVisible();
      }
      await expectTouchTarget(families);
      await families.click();
      await expect(page).toHaveURL('/families');
    });

    test('families pages fit and have large touch targets', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      await page.goto('/families');
      const name = `Responsive ${width} ${Date.now()}`;
      await page.getByLabel('Family name').fill(name);
      await page.getByRole('button', { name: 'Create family' }).click();
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Create family' }));
      await expectTouchTarget(page.getByRole('link', { name }));
      await page.screenshot({ path: `test-results/screens/families-${width}.png`, fullPage: true });
      await page.getByRole('link', { name }).click();
      await page.getByRole('textbox', { name: 'Email' }).fill('nobody-here@example.com');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.getByText('No user found.')).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Search' }));
      await expectTouchTarget(page.getByRole('textbox', { name: 'Email' }));
      await expectTouchTarget(page.getByRole('radio', { name: 'Name' }).locator('..'));
      await page.screenshot({ path: `test-results/screens/family-${width}.png`, fullPage: true });
    });
  });
}
