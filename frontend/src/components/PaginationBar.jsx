import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Previous and Next around "Page n"; hidden when everything fits on page 1. */
export default function PaginationBar({ page, hasMore, onPage }) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2">
      <Button variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)}>
        <ChevronLeftIcon />Previous
      </Button>
      <span className="text-sm">Page {page}</span>
      <Button variant="outline" disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Next<ChevronRightIcon />
      </Button>
    </nav>
  );
}
