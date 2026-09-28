import { request } from './client.js';

export function listFamilies() {
  return request('/api/families');
}

export function createFamily(name) {
  return request('/api/families', { method: 'POST', body: { name } });
}

export function getFamily(familyId) {
  return request(`/api/families/${familyId}`);
}

/** Search by `{ email }` (exact) or `{ name }` (3+ characters); returns `{ results, has_more }`. */
export function searchUsers(familyId, query) {
  return request(`/api/families/${familyId}/user-search?${new URLSearchParams(query)}`);
}

export function listFamilyInvitations(familyId) {
  return request(`/api/families/${familyId}/invitations`);
}

export function inviteUser(familyId, userId) {
  return request(`/api/families/${familyId}/invitations`, {
    method: 'POST',
    body: { user_id: userId },
  });
}

export function cancelInvitation(familyId, invitationId) {
  return request(`/api/families/${familyId}/invitations/${invitationId}`, { method: 'DELETE' });
}
