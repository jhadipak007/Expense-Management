import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { validRefresh } from '@/test/handlers.js';
import { server } from '@/test/setup.js';
import { renderApp } from '@/test/renderApp.jsx';

const INVITATION = {
  id: 5, family_id: 3, family_name: 'Jha Household', inviter_name: 'Dipak',
  expires_at: '2026-10-05T10:00:00Z',
};

/** Fake invitations API; `acceptStatus` 409 simulates an invitation cancelled meanwhile. */
function mockInvitationsApi({ acceptStatus = 200 } = {}) {
  let invitations = [INVITATION];
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
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

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

  it('accepts an invitation and links to the family', async () => {
    mockInvitationsApi();
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Jha Household' }));
    expect(await screen.findByRole('status')).toHaveTextContent('You joined Jha Household.');
    expect(screen.getByRole('link', { name: 'View family' })).toHaveAttribute('href', '/families/3');
    expect(screen.queryByRole('button', { name: /Accept/ })).not.toBeInTheDocument();
  });

  it('declines an invitation and removes it', async () => {
    mockInvitationsApi();
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Decline invitation to Jha Household' }));
    await waitFor(() => expect(screen.queryByText('Jha Household')).not.toBeInTheDocument());
  });

  it('says a cancelled invitation is no longer available', async () => {
    mockInvitationsApi({ acceptStatus: 409 });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Accept invitation to Jha Household' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This invitation is no longer available.');
    expect(screen.queryByText('Jha Household')).not.toBeInTheDocument();
  });
});
