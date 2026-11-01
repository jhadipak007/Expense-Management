import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder shaped like a form's labelled fields, announced as loading. */
export default function FormSkeleton({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <span className="sr-only">Loading...</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
