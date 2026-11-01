/**
 * Budget calls. Each sends the browser's local date as `today`, which picks the
 * current period and starts a new fortnightly budget's first fortnight.
 */
import { todayIso } from '@/utils/format.js';
import { request } from './client.js';

const withToday = (path) => `${path}?${new URLSearchParams({ today: todayIso() })}`;

export function listBudgets(signal) {
  return request(withToday('/api/budgets'), { signal });
}

export function getBudget(id, signal) {
  return request(withToday(`/api/budgets/${id}`), { signal });
}

export function createBudget(budget) {
  return request(withToday('/api/budgets'), { method: 'POST', body: budget });
}

/** Change `{ amount, period }`. */
export function updateBudget(id, changes) {
  return request(withToday(`/api/budgets/${id}`), { method: 'PATCH', body: changes });
}

export function deleteBudget(id) {
  return request(`/api/budgets/${id}`, { method: 'DELETE' });
}
