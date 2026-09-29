import { Link, useLocation, useNavigate } from 'react-router';
import { createExpense, listCategoriesAndFamilies } from '../../api/expenses.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import page from '../../styles/page.module.css';
import ExpenseForm from './ExpenseForm.jsx';
import styles from './NewExpense.module.css';

/**
 * Add an expense, then return to the dashboard, which confirms it was saved.
 * The dashboard's filters travel in the query string and are kept.
 */
export default function NewExpense() {
  const navigate = useNavigate();
  const dashboard = { pathname: '/', search: useLocation().search };
  const { data, error, loading } = useAsyncList(listCategoriesAndFamilies);

  async function save(payload) {
    const expense = await createExpense(payload);
    navigate(dashboard, { state: { savedExpense: expense } });
  }

  return (
    <section className={`${page.card} ${styles.card}`}>
      <Link className={page.back} to={dashboard}>Back to dashboard</Link>
      <h1 className={page.title}>Add expense</h1>
      {loading && <p className={page.muted}>Loading...</p>}
      {error && <p className={page.error} role="alert">Could not load the form. Please try again.</p>}
      {data && <ExpenseForm categories={data.categories} families={data.families} onSubmit={save} />}
    </section>
  );
}
