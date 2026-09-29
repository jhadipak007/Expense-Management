import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { createExpense, listExpenseFormOptions } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import BackLink from '@/components/BackLink.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageTitle } from '@/components/SectionCard.jsx';
import { Skeleton } from '@/components/ui/skeleton';
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
      <div className="flex flex-col gap-1">
        <PageTitle>Add expense</PageTitle>
        <p className="text-sm">Record what you spent, and share it with a family if you like.</p>
      </div>
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

/** Placeholder shaped like the form's fields. */
function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">Loading...</span>
      {[1, 2, 3, 4].map((row) => (
        <div key={row} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
