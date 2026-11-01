import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import EmptyState from '@/components/EmptyState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { logger } from '@/utils/logger.js';

/** Router error element: reports the render error and offers a reload. */
export default function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    logger.error(error?.message ?? String(error), { error });
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col bg-background p-4 text-muted-foreground">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description="The error has been reported. Reloading the page usually fixes it."
      >
        <Button className="min-h-11" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </EmptyState>
    </main>
  );
}
