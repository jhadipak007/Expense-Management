import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder shaped like a short list of rows. */
export default function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" role="status">
      <span className="sr-only">Loading...</span>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
