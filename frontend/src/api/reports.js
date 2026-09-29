import { request } from './client.js';

/** Totals by currency then category; personal when `familyId` is null. */
export function getSummary({ familyId, from, to, categoryIds }) {
  const params = new URLSearchParams({ date_from: from, date_to: to });
  if (familyId) params.set('family_id', familyId);
  for (const id of categoryIds) params.append('category_id', id);
  return request(`/api/reports/summary?${params}`);
}
