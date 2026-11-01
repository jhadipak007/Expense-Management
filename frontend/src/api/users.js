import { request } from './client.js';

/** Save the user's settings, e.g. `{ month_start_day: 15 }`; returns the updated user. */
export function updateSettings(settings) {
  return request('/api/users/me', { method: 'PATCH', body: settings });
}
