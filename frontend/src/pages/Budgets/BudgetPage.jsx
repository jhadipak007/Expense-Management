import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { createBudget, getBudget, updateBudget } from '@/api/budgets.js';
import { listExpenseFormOptions } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import BackLink from '@/components/BackLink.jsx';
import FormSkeleton from '@/components/FormSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import { formatMoney } from '@/utils/format.js';
import BudgetForm from './BudgetForm.jsx';
import { PERIOD_LABELS } from './budgetLabels.js';

/**
 * Create a budget (`/budgets/new`) or change one (`/budgets/:budgetId/edit`), then return
 * with a toast: to the Budgets page when opened from it (router state `returnTo`), otherwise
 * to the dashboard, whose filters travel in the query string.
 */
export default function BudgetPage() {
  const { budgetId } = useParams();
  const navigate = useNavigate();
  const { search, state } = useLocation();
  const fromBudgets = state?.returnTo === '/budgets';
  const back = fromBudgets ? '/budgets' : { pathname: '/', search };
  const load = useCallback(async (signal) => {
    const [options, budget] = await Promise.all([
      listExpenseFormOptions(), budgetId ? getBudget(budgetId, signal) : null,
    ]);
    return { ...options, budget };
  }, [budgetId]);
  const { data, error, loading } = useAsyncList(load);

  async function save(payload) {
    const saved = budgetId ? await updateBudget(budgetId, payload) : await createBudget(payload);
    toast.success('Budget saved', {
      description: `${formatMoney(saved.amount, saved.currency)} ${PERIOD_LABELS[saved.period].toLowerCase()}`,
    });
    navigate(back);
  }

  return (
    <SectionCard>
      <BackLink to={back}>{fromBudgets ? 'Back to budgets' : 'Back to dashboard'}</BackLink>
      <PageHeader
        title={budgetId ? 'Edit budget' : 'Create budget'}
        description="Set a spending limit that repeats every period."
      />
      {loading && <FormSkeleton />}
      {error && <Notice>Could not load this budget. Please try again.</Notice>}
      {data?.budget?.can_manage === false && (
        <Notice>Only the family owner can change this budget.</Notice>
      )}
      {data && data.budget?.can_manage !== false && (
        <BudgetForm
          categories={data.categories} currencies={data.currencies} families={data.families}
          budget={data.budget} onSubmit={save}
        />
      )}
    </SectionCard>
  );
}
