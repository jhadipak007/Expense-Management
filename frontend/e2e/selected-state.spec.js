import { expect, test } from '@playwright/test';
import { expectDashboard, logIn } from './helpers.js';

/** The theme's primary and primary-foreground colours, from `src/styles/global.css`. */
const THEMES = {
  light: { primary: 'rgb(58, 120, 181)', text: 'rgb(255, 255, 255)' },
  dark: { primary: 'rgb(106, 162, 220)', text: 'rgb(15, 23, 34)' },
};

const colours = (locator) => locator.evaluate((element) => {
  const style = getComputedStyle(element);
  return { background: style.backgroundColor, text: style.color };
});

/** Polled, because the controls fade between states with a CSS transition. */
async function expectSelected(selected, other, { primary, text }) {
  await expect.poll(() => colours(selected)).toEqual({ background: primary, text });
  await expect.poll(async () => (await colours(other)).background).not.toBe(primary);
}

for (const [scheme, theme] of Object.entries(THEMES)) {
  test(`the selected period and view are filled with the primary colour (${scheme})`, async ({ page }) => {
    // No saved theme, so the app follows the system colour scheme.
    await page.emulateMedia({ colorScheme: scheme });
    await logIn(page);
    await expectDashboard(page);
    await expectSelected(
      page.getByRole('radio', { name: 'This month' }), page.getByRole('radio', { name: 'Last month' }), theme,
    );

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Transactions' }).click();
    const list = page.getByRole('tab', { name: 'Transactions' });
    const audit = page.getByRole('tab', { name: 'Audit log' });
    await expect(list).toHaveAttribute('aria-selected', 'true');
    await expectSelected(list, audit, theme);
    await audit.click();
    await expect(audit).toHaveAttribute('aria-selected', 'true');
    await expectSelected(audit, list, theme);
  });
}
