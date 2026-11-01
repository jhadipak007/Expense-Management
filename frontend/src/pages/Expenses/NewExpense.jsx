import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { createExpense, listExpenseFormOptions } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import BackLink from '@/components/BackLink.jsx';
import FormSkeleton from '@/components/FormSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import { formatMoney } from '@/utils/format.js';
import ExpenseForm from './ExpenseForm.jsx';

/**
 * Add an expense, then return to the dashboard with a toast confirming it was saved.
 * The dashboard's filters travel in the query string and are kept.
 */
export default function NewExpense() {
  const navigate = useNavigate();
  const dashboard = { pathname: '/', search: useLocation().search };
  const { data, error, loading } = useAsyncList(listExpenseFormOptions);

  async function save(payload) {
    const expense = await createExpense(payload);
    toast.success('Expense saved', {
      description: `${formatMoney(expense.amount, expense.currency)} for ${expense.category.name}`,
    });
    navigate(dashboard);
  }

  return (
    <SectionCard className="max-w-2xl">
      <BackLink to={dashboard}>Back to dashboard</BackLink>
      <PageHeader title="Add expense" description="Record what you spent, and share it with a family if you like." />
      {loading && <FormSkeleton />}
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
