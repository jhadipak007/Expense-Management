import { request } from './client.js';
import { listFamilies } from './families.js';

export function listCategories() {
  return request('/api/categories');
}

/** Categories and the user's families, loaded together. */
export async function listCategoriesAndFamilies() {
  const [categories, families] = await Promise.all([listCategories(), listFamilies()]);
  return { categories, families };
}

export function createExpense(expense) {
  return request('/api/expenses', { method: 'POST', body: expense });
}
