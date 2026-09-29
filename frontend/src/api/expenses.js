import { request } from './client.js';
import { listFamilies } from './families.js';

export function listCategories() {
  return request('/api/categories');
}

export function listCurrencies() {
  return request('/api/currencies');
}

/** Categories and the user's families, loaded together. */
export async function listCategoriesAndFamilies() {
  const [categories, families] = await Promise.all([listCategories(), listFamilies()]);
  return { categories, families };
}

/** Everything the expense form offers: categories, currencies and the user's families. */
export async function listExpenseFormOptions() {
  const [options, currencies] = await Promise.all([listCategoriesAndFamilies(), listCurrencies()]);
  return { ...options, currencies };
}

export function createExpense(expense) {
  return request('/api/expenses', { method: 'POST', body: expense });
}
