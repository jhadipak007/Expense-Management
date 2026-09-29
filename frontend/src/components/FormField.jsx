import { cn } from 'cn';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Field label in the app's heading style. */
export function FieldLabel({ className, ...props }) {
  return <Label className={cn('text-base font-semibold text-foreground', className)} {...props} />;
}

/** Error text under a control; its id is what the control's aria-describedby points at. */
export function FieldError({ id, children }) {
  return (
    <p id={id} className="text-sm text-destructive">
      {children}
    </p>
  );
}

/**
 * Labelled input whose error is linked with aria-describedby.
 * `icon` adds a decorative leading icon; `revealable` makes it a password
 * input with a show/hide toggle named after the label.
 */
export default function FormField({ id, label, error, onChange, icon, revealable, type, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3 flex text-muted-foreground [&_svg]:size-5">
            {icon}
          </span>
        )}
        <Input
          id={id}
          type={revealable ? (visible ? 'text' : 'password') : type}
          className={cn('bg-card text-foreground', icon && 'pl-11', revealable && 'pr-11')}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {revealable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 text-muted-foreground [&_svg:not([class*='size-'])]:size-5"
            aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            onClick={() => setVisible((shown) => !shown)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </Button>
        )}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
