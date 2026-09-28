import { request } from './client.js';

/** The logged-in user's open invitations. */
export function listMyInvitations() {
  return request('/api/invitations');
}

/** Join the family; returns it with the user's role. */
export function acceptInvitation(invitationId) {
  return request(`/api/invitations/${invitationId}/accept`, { method: 'POST' });
}

export function declineInvitation(invitationId) {
  return request(`/api/invitations/${invitationId}/decline`, { method: 'POST' });
}
