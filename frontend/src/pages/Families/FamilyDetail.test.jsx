import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '../../test/handlers.js';
import { server } from '../../test/setup.js';
import { renderApp } from '../../test/renderApp.jsx';

const PRIYA = { user_id: 1, display_name: 'Priya', email: 'priya@example.com', role: 'owner' };
const RAVI = { user_id: 2, display_name: 'Ravi', email: 'ravi@example.com' };
const SENT = '2026-09-28T10:00:00Z';
const EXPIRES = '2026-10-05T10:00:00Z';
const RAVI_INVITATION = { id: 7, invitee_id: 2, invitee_name: 'Ravi', created_at: SENT,
  expires_at: EXPIRES };

/** A fake family API: family 1 owned (or joined) by Priya, with in-memory invitations. */
function mockFamilyApi({
  role = 'owner', search = { results: [RAVI], has_more: false }, invitations = [],
} = {}) {
  const calls = { search: [] };
  server.use(
    validRefresh,
    http.get('/api/families/1', () =>
      HttpResponse.json({ id: 1, name: 'Jha Household', role, members: [PRIYA] })),
    http.get('/api/families/404', () =>
      HttpResponse.json({ detail: 'Family not found' }, { status: 404 })),
    http.get('/api/families/1/user-search', ({ request }) => {
      calls.search.push(Object.fromEntries(new URL(request.url).searchParams));
      return HttpResponse.json(search);
    }),
    http.get('/api/families/1/invitations', () => HttpResponse.json(invitations)),
    http.post('/api/families/1/invitations', async ({ request }) => {
      const { user_id: userId } = await request.json();
      if (invitations.some((i) => i.invitee_id === userId)) {
        return HttpResponse.json(
          { detail: 'This person already has a pending invitation to the family' },
          { status: 409 },
        );
      }
      invitations = [...invitations, RAVI_INVITATION];
      return HttpResponse.json(RAVI_INVITATION, { status: 201 });
    }),
    http.delete('/api/families/1/invitations/7', () => {
      invitations = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

async function searchFor(user, mode, text) {
  await user.click(await screen.findByRole('radio', { name: mode }));
  if (text) await user.type(screen.getByLabelText(mode, { selector: 'input:not([type=radio])' }), text);
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

function pendingSection() {
  return screen.getByRole('heading', { name: 'Pending invitations' }).closest('section');
}

describe('Family detail page', () => {
  it('shows members with name, email and role', async () => {
    mockFamilyApi();
    renderApp('/families/1');
    expect(await screen.findByRole('heading', { name: 'Jha Household' })).toBeInTheDocument();
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('hides search and invitations from members who are not the owner', async () => {
    mockFamilyApi({ role: 'member' });
    renderApp('/families/1');
    await screen.findByRole('heading', { name: 'Jha Household' });
    expect(screen.queryByRole('heading', { name: 'Invite people' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pending invitations' })).not.toBeInTheDocument();
  });

  it('says the family was not found for a non-member', async () => {
    mockFamilyApi();
    renderApp('/families/404');
    expect(await screen.findByRole('alert')).toHaveTextContent('Family not found');
  });

  it('finds a user by email and invites them into the pending list', async () => {
    const calls = mockFamilyApi();
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Email', 'ravi@example.com');
    expect(calls.search).toEqual([{ email: 'ravi@example.com' }]);
    await user.click(await screen.findByRole('button', { name: 'Invite Ravi' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Invitation sent to Ravi.');
    const pending = pendingSection();
    expect(await within(pending).findByText('Ravi')).toBeInTheDocument();
    expect(within(pending).getByText(/Sent .*2026 · Expires .*2026/)).toBeInTheDocument();
  });

  it('asks for at least 3 characters before a name search', async () => {
    const calls = mockFamilyApi();
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Name', 'ra');
    expect(screen.getByText('Enter at least 3 characters')).toBeInTheDocument();
    expect(calls.search).toEqual([]);
  });

  it('shows masked emails for a name search', async () => {
    const calls = mockFamilyApi({ search: {
      results: [{ user_id: 2, display_name: 'Ravi', email: 'r****@example.com' }],
      has_more: false,
    } });
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Name', 'rav');
    expect(await screen.findByText('r****@example.com')).toBeInTheDocument();
    expect(calls.search).toEqual([{ name: 'rav' }]);
  });

  it('says when no user matches', async () => {
    mockFamilyApi({ search: { results: [], has_more: false } });
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Email', 'nobody@example.com');
    expect(await screen.findByText('No user found.')).toBeInTheDocument();
  });

  it('asks the owner to narrow the search when there are more than 10 matches', async () => {
    mockFamilyApi({ search: { results: [RAVI], has_more: true } });
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Name', 'sam');
    expect(await screen.findByText(/Narrow your search/)).toBeInTheDocument();
  });

  it('explains why a duplicate invitation cannot be sent', async () => {
    mockFamilyApi({ invitations: [RAVI_INVITATION] });
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Email', 'ravi@example.com');
    await user.click(await screen.findByRole('button', { name: 'Invite Ravi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already has a pending invitation');
  });

  it('cancels a pending invitation', async () => {
    mockFamilyApi();
    const { user } = renderApp('/families/1');
    await searchFor(user, 'Email', 'ravi@example.com');
    await user.click(await screen.findByRole('button', { name: 'Invite Ravi' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel invitation for Ravi' }));
    expect(await within(pendingSection()).findByText('No pending invitations.')).toBeInTheDocument();
  });
});
