import { cn } from 'cn';

const KINDS = {
  error: { role: 'alert', className: 'border-destructive text-destructive' },
  success: { role: 'status', className: 'border-success text-foreground' },
};

/** Boxed message: an error is announced as an alert, a success as a status. */
export default function Notice({ kind = 'error', className, children }) {
  const { role, className: kindClass } = KINDS[kind];
  return (
    <p role={role} className={cn('rounded-md border p-3 text-sm', kindClass, className)}>
      {children}
    </p>
  );
}
