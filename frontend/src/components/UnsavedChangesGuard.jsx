import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * While `dirty`, asks before the user leaves the page: a dialog for in-app navigation,
 * the browser's own prompt for closing or reloading the tab.
 */
export default function UnsavedChangesGuard({ dirty }) {
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // No onOpenChange: Radix also fires it when Discard closes the dialog, which would undo proceed().
  return (
    <AlertDialog open={blocker.state === 'blocked'}>
      <AlertDialogContent className="bg-card" onEscapeKeyDown={() => blocker.reset()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>Your changes on this page have not been saved.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset()}>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => blocker.proceed()}>Discard changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
