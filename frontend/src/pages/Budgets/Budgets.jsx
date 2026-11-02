import { listCategoriesAndFamilies } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import BudgetsSection from '../Dashboard/BudgetsSection.jsx';

/** The Budgets page (`/budgets`): the dashboard's budgets section on its own page. */
export default function Budgets() {
  const { data, error, loading, reload } = useAsyncList(listCategoriesAndFamilies);

  if (error) {
    return (
      <SectionCard>
        <PageHeader title="Budgets" description="Spending limits for you and your families." />
        <Notice>Could not load your budgets.</Notice>
        <Button variant="outline" className="self-start" onClick={reload}>Retry</Button>
      </SectionCard>
    );
  }
  if (loading && !data) return <Skeleton className="h-60 w-full rounded-xl" />;
  return <BudgetsSection categories={data.categories} families={data.families} asPage />;
}
