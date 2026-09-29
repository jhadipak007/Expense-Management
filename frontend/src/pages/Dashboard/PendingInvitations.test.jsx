import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

const INVITATION = {
  id: 5, family_id: 3, family_name: 'Jha Household', inviter_name: 'Dipak',
  expires_at: '2026-10-05T10:00:00Z',
};

/**
 * Fake invitations API; `acceptStatus` 409 simulates an invitation cancelled meanwhile.
 * Returns the ids of declined invitations.
 */
function mockInvitationsApi({ acceptStatus = 200 } = {}) {
  let invitations = [INVITATION];
  const declined = [];
  server.use(
    validRefresh,
    http.get('/api/invitations', () => HttpResponse.json(invitations)),
    http.post('/api/invitations/5/accept', () => {
      invitations = [];
      if (acceptStatus === 409) {
        return HttpResponse.json({ detail: 'This invitation is no longer available' },
          { status: 409 });
      }
      return HttpResponse.json({ id: 3, name: 'Jha Household', role: 'member' });
    }),
    http.post('/api/invitations/5/decline', () => {
      invitations = [];
      declined.push(5);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return declined;
}

const decline = () => screen.findByRole('button', { name: 'Decline invitation to Jha Household' });

describe('Dashboard invitations', () => {
  it('shows each pending invitation with family, inviter and expiry', async () => {
    mockInvitationsApi();
    renderApp('/');
    expect(await screen.findByText('Jha Household')).toBeInTheDocument();
    expect(screen.getByText(/Invited by Dipak · Expires .*2026/)).toBeInTheDocument();
  });

  it('shows nothing when there are no invitations', async () => {
    server.use(validRefresh);
    renderApp('/');
    await screen.findByRole('heading', { name: 'Welcome, Priya' });
    expect(screen.queryByRole('heading', { name: 'Family invitations' })).not.toBeInTheDocument();
  });

  it('says when invitations could not be loaded', async () => {
    server.use(validRefresh, http.get('/api/invitations', () => HttpResponse.json({}, { status: 500 })));
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your invitations.');
  });

  it('accepts an invitation, confirms it with a toast and shows the family card', async () => {
    mockInvitationsApi();
    let families = [];
    server.use(http.get('/api/families', () => HttpResponse.json(families)));
    const { user } = renderApp('/');
    await screen.findByRole('region', { name: 'Personal' });
    families = [{ id: 3, name: 'Jha Household', role: 'member' }];
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Jha Household' }));
    expect(await screen.findByText('You joined Jha Household')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Jha Household' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept/ })).not.toBeInTheDocument();
  });

  it('declines an invitation after confirming and removes it', async () => {
    const declined = mockInvitationsApi();
    const { user } = renderApp('/');
    await user.click(await decline());
    const dialog = screen.getByRole('alertdialog', { name: 'Decline the invitation to Jha Household?' });
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    expect(await screen.findByText('Invitation to Jha Household declined')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Jha Household')).not.toBeInTheDocument());
    expect(declined).toEqual([5]);
  });

  it('keeps the invitation when the decline is not confirmed', async () => {
    const declined = mockInvitationsApi();
    const { user } = renderApp('/');
    await user.click(await decline());
    await user.click(screen.getByRole('button', { name: 'Keep invitation' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Jha Household')).toBeInTheDocument();
    expect(declined).toEqual([]);
  });

  it('says a cancelled invitation is no longer available', async () => {
    mockInvitationsApi({ acceptStatus: 409 });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Jha Household' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This invitation is no longer available.');
    expect(screen.queryByText('Jha Household')).not.toBeInTheDocument();
  });
});
