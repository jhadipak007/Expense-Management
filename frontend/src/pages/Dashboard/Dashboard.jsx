import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { PlusIcon } from 'lucide-react';
import { listCategoriesAndFamilies } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import { useAuth } from '@/auth/useAuth.js';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageTitle } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardFilters from './DashboardFilters.jsx';
import { parseFilters, toSearchParams } from './dashboardFilters.js';
import PendingInvitations from './PendingInvitations.jsx';
import SummaryCard from './SummaryCard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Same object until the URL changes, so cards reload only when a filter changes.
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const options = useAsyncList(listCategoriesAndFamilies);
  // Adding an expense keeps the filters, which travel in the query string.
  const addExpense = { pathname: '/expenses/new', search: useLocation().search };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <PageTitle>Welcome, {user.display_name}</PageTitle>
          <p className="text-sm">Your personal and family spending at a glance.</p>
        </div>
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
            filters={filters} categories={options.data.categories}
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
