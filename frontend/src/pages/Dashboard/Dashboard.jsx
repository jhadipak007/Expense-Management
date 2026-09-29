import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { listCategoriesAndFamilies } from '@/api/expenses.js';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import { useAuth } from '@/auth/useAuth.js';
import Notice from '@/components/Notice.jsx';
import SectionCard, { PageTitle } from '@/components/SectionCard.jsx';
import { Button } from '@/components/ui/button';
import DashboardFilters from './DashboardFilters.jsx';
import { parseFilters, toSearchParams } from './dashboardFilters.js';
import PendingInvitations from './PendingInvitations.jsx';
import SummaryCard from './SummaryCard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Same object until the URL changes, so cards reload only when a filter changes.
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const options = useAsyncList(listCategoriesAndFamilies);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard className="gap-2 p-6">
        <PageTitle>Welcome, {user.display_name}</PageTitle>
        <Button asChild className="w-full md:w-auto md:self-start">
          <Link to={{ pathname: '/expenses/new', search: location.search }}>Add expense</Link>
        </Button>
      </SectionCard>
      {options.loading && !options.data && <p className="text-sm">Loading...</p>}
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
            <SummaryCard title="Personal" familyId={null} filters={filters} />
            {options.data.families.map((family) => (
              <SummaryCard
                key={family.id} title={family.name} familyId={family.id} filters={filters}
              />
            ))}
          </div>
        </>
      )}
      <PendingInvitations />
    </div>
  );
}
