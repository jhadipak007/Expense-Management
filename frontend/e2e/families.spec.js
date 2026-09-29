import { expect, test } from '@playwright/test';
import { ensureFamily, expectDashboard, logIn, logOut, TEST_USER } from './helpers.js';
import { fillSignUp, newEmail, submitCode } from './register-helpers.js';

/** Sign up a new user with a unique name and email, then log out. */
async function signUpAndLogOut(page) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const person = { name: `Asha ${suffix}`, email: newEmail(), password: 'longenough' };
  await fillSignUp(page, person);
  await submitCode(page, '2211');
  await expect(page.getByRole('heading', { name: `Welcome, ${person.name}` })).toBeVisible();
  await logOut(page, person.name);
  return person;
}

/** As the logged-in owner, open the invitations test family, creating it on the first run. */
async function openFamily(page) {
  const name = await ensureFamily(page, 'E2E Invitations');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  return name;
}

async function invite(page, person, by) {
  await page.getByRole('radio', { name: by === 'email' ? 'Email' : 'Name' }).check();
  await page.getByRole('textbox', { name: by === 'email' ? 'Email' : 'Name' })
    .fill(by === 'email' ? person.email : person.name);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: `Invite ${person.name}` }).click();
  await expect(page.getByRole('status')).toHaveText(`Invitation sent to ${person.name}.`);
}

function pendingInvitations(page) {
  return page.locator('section', { has: page.getByRole('heading', { name: 'Pending invitations' }) });
}

test('owner invites a user who accepts and joins the family', async ({ page }) => {
  const asha = await signUpAndLogOut(page);
  await logIn(page);
  await expectDashboard(page);
  const family = await openFamily(page);
  await invite(page, asha, 'name');
  await expect(pendingInvitations(page).getByText(asha.name)).toBeVisible();
  await logOut(page);

  await logIn(page, asha);
  await expect(page.getByText(`Invited by ${TEST_USER.name}`)).toBeVisible();
  await page.getByRole('button', { name: `Accept invitation to ${family}` }).click();
  await expect(page.getByText(`You joined ${family}`)).toBeVisible();
  await expect(page.getByRole('region', { name: family })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Families' }).click();
  await page.getByRole('link', { name: family, exact: true }).click();
  await expect(page.getByRole('heading', { name: family })).toBeVisible();
  await expect(page.getByText(TEST_USER.email)).toBeVisible();
  await expect(page.getByText(asha.email)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invite people' })).toHaveCount(0);
});

test('a cancelled invitation disappears from the invitee dashboard', async ({ page }) => {
  const asha = await signUpAndLogOut(page);
  await logIn(page);
  await expectDashboard(page);
  const family = await openFamily(page);
  await invite(page, asha, 'email');
  await page.getByRole('button', { name: `Cancel invitation for ${asha.name}` }).click();
  await expect(pendingInvitations(page).getByText('No pending invitations.')).toBeVisible();
  await logOut(page);

  await logIn(page, asha);
  await expect(page.getByRole('heading', { name: `Welcome, ${asha.name}` })).toBeVisible();
  await expect(page.getByText(family)).toHaveCount(0);
});
