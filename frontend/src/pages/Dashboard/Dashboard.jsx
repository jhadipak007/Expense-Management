import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { PlusIcon } from 'lucide-react';
import { listCategoriesAndFamilies } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import { useAuth } from '@/auth/useAuth.js';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageHeader } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import BudgetsSection from './BudgetsSection.jsx';
import DashboardFilters from './DashboardFilters.jsx';
import { parseFilters, toSearchParams } from './dashboardFilters.js';
import PendingInvitations from './PendingInvitations.jsx';
import SummaryCard from './SummaryCard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // The viewer's own day sets "This month" and "Last month" for every card.
  const monthStartDay = user.month_start_day;
  // Same object until the URL or the start day changes, so cards reload only then.
  const filters = useMemo(() => parseFilters(searchParams, monthStartDay), [searchParams, monthStartDay]);
  const options = useAsyncList(listCategoriesAndFamilies);
  // Adding an expense or a budget keeps the filters, which travel in the query string.
  const { search } = useLocation();
  const addExpense = { pathname: '/expenses/new', search };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader
          title={`Welcome, ${user.display_name}`} description="Your personal and family spending at a glance."
        />
        <Button asChild className="w-full md:w-auto">
          <Link to={addExpense}><PlusIcon />Add expense</Link>
        </Button>
      </div>
      {options.loading && !options.data && <DashboardSkeleton />}
      {options.error && (
        <SectionCard>
          <Notice>Could not load your summaries.</Notice>
          <Button variant="outline" className="self-start" onClick={options.reload}>Retry</Button>
        </SectionCard>
      )}
      {options.data && (
        <>
          <DashboardFilters
            filters={filters} categories={options.data.categories} monthStartDay={monthStartDay}
            onChange={(next) => setSearchParams(toSearchParams(next), { replace: true })}
            onReset={() => setSearchParams({}, { replace: true })}
          />
          <div className="grid gap-4 md:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
            <SummaryCard title="Personal" familyId={null} filters={filters} addExpense={addExpense} />
            {options.data.families.map((family) => (
              <SummaryCard
                key={family.id} title={family.name} familyId={family.id} filters={filters}
                addExpense={addExpense}
              />
            ))}
          </div>
          {/* Keyed on the families, so joining one from an invitation reloads the budgets too. */}
          <BudgetsSection
            key={options.data.families.map((f) => f.id).join()}
            categories={options.data.categories} families={options.data.families} search={search}
          />
        </>
      )}
      <PendingInvitations onJoined={options.reload} />
    </div>
  );
}

/** Placeholder shaped like the filters and two summary cards. */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">Loading...</span>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
