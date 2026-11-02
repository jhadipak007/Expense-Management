import { Link } from 'react-router';
import { PlusIcon, ReceiptTextIcon } from 'lucide-react';
import { useAsyncList } from '@/hooks/useAsyncList.js';
import EmptyState from '@/components/EmptyState.jsx';
import { ItemList } from '@/components/ItemRow.jsx';
import ListSkeleton from '@/components/ListSkeleton.jsx';
import Notice from '@/components/Notice.jsx';
import PaginationBar from '@/components/PaginationBar.jsx';
import { Button } from '@/components/ui/button';

/**
 * Loads a page with `load`, then shows its items, a skeleton, an error with Retry, or an
 * empty state with an Add expense link, and the pager. Shared by the list and the audit log.
 */
export default function PagedList({ load, filters, onPage, label, empty, renderItem }) {
  const { data, error, loading, reload } = useAsyncList(load);
  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      {loading && <p className="sr-only" role="status">Loading...</p>}
      {loading && !data && !error && <ListSkeleton />}
      {error && (
        <>
          <Notice>{error.status === 404 ? 'You are not a member of this family.' : `Could not load ${label.toLowerCase()}.`}</Notice>
          <Button variant="outline" className="self-start" onClick={reload}>Retry</Button>
        </>
      )}
      {data?.items.length === 0 && (
        <EmptyState icon={ReceiptTextIcon} title={empty} description="Expenses you add appear here.">
          <Button asChild variant="outline"><Link to="/expenses/new"><PlusIcon />Add an expense</Link></Button>
        </EmptyState>
      )}
      {data?.items.length > 0 && (
        <ItemList aria-label={label} className={loading ? 'opacity-60' : undefined}>
          {data.items.map(renderItem)}
        </ItemList>
      )}
      {data && <PaginationBar page={filters.page} hasMore={data.has_more} onPage={onPage} />}
    </div>
  );
}
