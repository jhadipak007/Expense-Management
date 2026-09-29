import { useLocation, useNavigate } from 'react-router';
import { createExpense, listExpenseFormOptions } from '../../api/expenses.js';
import { useAsyncList } from '../../hooks/useAsyncList.js';
import BackLink from '@/components/BackLink.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard from '@/components/SectionCard.jsx';
import ExpenseForm from './ExpenseForm.jsx';

/**
 * Add an expense, then return to the dashboard, which confirms it was saved.
 * The dashboard's filters travel in the query string and are kept.
 */
export default function NewExpense() {
  const navigate = useNavigate();
  const dashboard = { pathname: '/', search: useLocation().search };
  const { data, error, loading } = useAsyncList(listExpenseFormOptions);

  async function save(payload) {
    const expense = await createExpense(payload);
    navigate(dashboard, { state: { savedExpense: expense } });
  }

  return (
    <SectionCard className="max-w-2xl">
      <BackLink to={dashboard}>Back to dashboard</BackLink>
      <h1 className="text-2xl font-bold wrap-anywhere text-foreground md:text-3xl">Add expense</h1>
      {loading && <p className="text-sm">Loading...</p>}
      {error && <Notice>Could not load the form. Please try again.</Notice>}
      {data && (
        <ExpenseForm
          categories={data.categories} currencies={data.currencies} families={data.families}
          onSubmit={save}
        />
      )}
    </SectionCard>
  );
}
