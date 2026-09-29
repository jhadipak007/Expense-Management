import { cn } from 'cn';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

/** Label, control and error; the control's aria-describedby points at `${id}-error`. */
function Field({ id, label, error, children }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-base font-semibold text-foreground">{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props that link a control to its label and error. */
function controlProps(id, error) {
  return { id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined };
}

/**
 * Labelled input whose error is linked with aria-describedby.
 * `icon` adds a decorative leading icon; `revealable` makes it a password
 * input with a show/hide toggle named after the label.
 */
export default function FormField({ id, label, error, onChange, icon, revealable, type, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} error={error}>
      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3 flex text-muted-foreground [&_svg]:size-5">
            {icon}
          </span>
        )}
        <Input
          {...controlProps(id, error)}
          type={revealable ? (visible ? 'text' : 'password') : type}
          className={cn('bg-card text-foreground', icon && 'pl-11', revealable && 'pr-11')}
          onChange={(event) => onChange(event.target.value)}
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
    </Field>
  );
}

/** Labelled native select (`children` are its options), linked to its error like `FormField`. */
export function SelectField({ id, label, error, value, onChange, children }) {
  return (
    <Field id={id} label={label} error={error}>
      <NativeSelect
        {...controlProps(id, error)}
        className="bg-card text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
    </Field>
  );
}
