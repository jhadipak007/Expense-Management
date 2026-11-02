import { useState } from 'react';
import { Link } from 'react-router';
import { PiggyBankIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { deleteBudget, listBudgets } from '@/api/budgets.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import EmptyState from '@/components/EmptyState.jsx';
import Notice from '@/components/Notice.jsx';
import SectionCard, { CardHeading, PageHeader } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import BudgetGroup from './BudgetGroup.jsx';

/**
 * Budgets grouped under Personal and each family that has any, on the dashboard or the
 * Budgets page (`asPage`: an h1 title, and Create/Edit return to the Budgets page).
 * Loaded on mount, so returning from Add expense shows the new spending.
 * `search` is the dashboard's query string, kept on the budget page links.
 */
export default function BudgetsSection({ categories, families, search, asPage = false }) {
  const { data: budgets, error, loading, reload } = useAsyncList(listBudgets);
  const [busyId, setBusyId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const state = asPage ? { returnTo: '/budgets' } : undefined;
  const createLink = { to: { pathname: '/budgets/new', search }, state };
  const editLink = (budget) => ({ to: { pathname: `/budgets/${budget.id}/edit`, search }, state });

  async function remove(budget) {
    setBusyId(budget.id);
    setDeleteError('');
    try {
      await deleteBudget(budget.id);
      toast.success('Budget deleted');
      await reload();
    } catch {
      setDeleteError('Could not delete the budget. Please try again.');
    }
    setBusyId(null);
  }

  const groups = budgets && [
    { key: 'personal', title: 'Personal', personal: true, budgets: budgets.filter((b) => b.family_id === null) },
    ...families.map((f) => ({ key: f.id, title: f.name, budgets: budgets.filter((b) => b.family_id === f.id) })),
  ].filter((group) => group.budgets.length > 0);

  return (
    <section aria-labelledby="budgets-heading" aria-busy={loading} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {asPage ? (
          <PageHeader
            id="budgets-heading" title="Budgets" description="Spending limits for you and your families."
          />
        ) : (
          <CardHeading id="budgets-heading">Budgets</CardHeading>
        )}
        {groups?.length > 0 && (
          <Button asChild variant="outline" className="w-full md:w-auto">
            <Link {...createLink}><PlusIcon />Create budget</Link>
          </Button>
        )}
      </div>
      {loading && !budgets && !error && <Skeleton className="h-40 w-full rounded-xl" />}
      {error && (
        <SectionCard aria-label="Budgets error">
          <Notice>Could not load your budgets.</Notice>
          <Button variant="outline" className="self-start" onClick={reload}>Retry</Button>
        </SectionCard>
      )}
      {deleteError && <Notice>{deleteError}</Notice>}
      {groups?.length === 0 && (
        <EmptyState
          icon={PiggyBankIcon} title="No budgets yet"
          description="Set a spending limit to see how your spending compares."
        >
          <Button asChild variant="outline">
            <Link {...createLink}><PlusIcon />Create budget</Link>
          </Button>
        </EmptyState>
      )}
      {groups?.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(22rem,1fr))]">
          {groups.map((group) => (
            <BudgetGroup
              key={group.key} title={group.title} personal={group.personal} budgets={group.budgets}
              categories={categories} editLink={editLink} busyId={busyId} onDelete={remove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
