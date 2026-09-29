import { request } from './client.js';

export function listCategories() {
  return request('/api/categories');
}

export function createExpense(expense) {
  return request('/api/expenses', { method: 'POST', body: expense });
}
