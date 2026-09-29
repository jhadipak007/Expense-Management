import { cn } from 'cn';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Submit button; while `pending` it shows a spinner and is disabled. Full width unless overridden. */
export default function SubmitButton({ pending, pendingLabel, disabled, className, children }) {
  return (
    <Button type="submit" className={cn('w-full', className)} disabled={pending || disabled}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
