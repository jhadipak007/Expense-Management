import { request } from './client.js';

/** Query string for a space and its filters; arrays become repeated keys. */
function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of [value].flat()) if (item !== null && item !== undefined && item !== '') search.append(key, item);
  }
  return search;
}

/** A page of live expenses in one space: `{ items, has_more }`. */
export function listTransactions(params, signal) {
  return request(`/api/expenses?${query(params)}`, { signal });
}

/** A page of actions on one space's expenses, deleted ones included. */
export function listAuditLog(params, signal) {
  return request(`/api/expenses/audit-log?${query(params)}`, { signal });
}

/** One expense with its history, last change and whether the viewer may edit it. */
export function getTransaction(id, signal) {
  return request(`/api/expenses/${id}`, { signal });
}

export function updateTransaction(id, expense) {
  return request(`/api/expenses/${id}`, { method: 'PATCH', body: expense });
}

export function deleteTransaction(id) {
  return request(`/api/expenses/${id}`, { method: 'DELETE' });
}

export function restoreTransaction(id) {
  return request(`/api/expenses/${id}/restore`, { method: 'POST' });
}
