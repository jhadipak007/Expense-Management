import { expect, test } from '@playwright/test';
import { addExpense, createFamily, signUpFresh } from './dashboard-helpers.js';
import { TEST_USER, ensureFamily, expectDashboard, logIn } from './helpers.js';
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

    test('dashboard fits and the user menu holds Logout', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      await expectNoHorizontalScroll(page);
      const userMenu = page.getByRole('button', { name: TEST_USER.name });
      await expectTouchTarget(userMenu);
      await userMenu.click();
      // Measure after the menu's zoom-in animation, which scales it while opening.
      await page.getByRole('menu').evaluate((menu) => Promise.all(menu.getAnimations().map((a) => a.finished)));
      await expectTouchTarget(page.getByRole('menuitem', { name: 'Logout' }));
      await expectNoHorizontalScroll(page);
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `test-results/screens/dashboard-${width}.png`, fullPage: true });
    });

    test('dashboard summaries stack on phones and sit side by side from 768px', async ({ page }) => {
      await signUpFresh(page);
      await createFamily(page, 'Asha Home');
      await addExpense(page, { amount: '12450', currency: 'INR', category: 'Grocery' });
      await addExpense(page, { amount: '85', currency: 'USD', category: 'Trips' });
      const personal = page.getByRole('region', { name: 'Personal' });
      const family = page.getByRole('region', { name: 'Asha Home' });
      await expect(personal.getByText('INR 12,450.00').first()).toBeVisible();
      await expect(family.getByText('No expenses match these filters')).toBeVisible();
      const [a, b] = [await personal.boundingBox(), await family.boundingBox()];
      expect(Math.abs(a.y - b.y) < 1).toBe(width >= 768);
      await expectTouchTarget(page.getByRole('radio', { name: 'This month' }));
      await expectTouchTarget(page.getByRole('button', { name: 'Grocery', exact: true }));
      await expectTouchTarget(page.getByRole('button', { name: 'Reset' }));
      await page.getByRole('radio', { name: 'Custom' }).click();
      await expectTouchTarget(page.getByLabel('From'));
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `test-results/screens/summary-${width}.png`, fullPage: true });
    });

    test('add expense form fits and has large touch targets', async ({ page }) => {
      await logIn(page);
      await expectDashboard(page);
      await page.getByRole('link', { name: 'Add expense' }).click();
      await expectTouchTarget(page.getByLabel('Amount'));
      await expectTouchTarget(page.getByLabel('Currency'));
      await expectTouchTarget(page.getByLabel('Category'));
      await expectTouchTarget(page.getByLabel('Date'));
      await expectTouchTarget(page.getByLabel('Share with'));
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
      const name = await ensureFamily(page, 'E2E Responsive');
      await expectNoHorizontalScroll(page);
      await expectTouchTarget(page.getByRole('button', { name: 'Create family' }));
      await expectTouchTarget(page.getByRole('link', { name, exact: true }));
      await page.screenshot({ path: `test-results/screens/families-${width}.png`, fullPage: true });
      await page.getByRole('link', { name, exact: true }).click();
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
