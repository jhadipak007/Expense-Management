import { cn } from 'cn';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

/**
 * Label, control, then an optional hint and the error. The control's aria-describedby
 * points at the error while there is one, else at the hint.
 */
function Field({ id, label, hint, error, children }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-base font-semibold text-foreground">{label}</Label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-sm">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props that link a control to its label, and to its error or hint. */
function controlProps(id, error, hint) {
  const describedBy = (error && `${id}-error`) || (hint && `${id}-hint`) || undefined;
  return { id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy };
}

/**
 * Labelled input whose hint or error is linked with aria-describedby.
 * `icon` adds a decorative leading icon; `revealable` makes it a password
 * input with a show/hide toggle named after the label.
 */
export default function FormField({
  id, label, hint, error, onChange, icon, revealable, type, ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3 flex text-muted-foreground [&_svg]:size-5">
            {icon}
          </span>
        )}
        <Input
          {...controlProps(id, error, hint)}
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

/** Labelled native select (`children` are its options), linked to its hint or error like `FormField`. */
export function SelectField({ id, label, hint, error, value, onChange, children }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <NativeSelect
        {...controlProps(id, error, hint)}
        className="bg-card text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </NativeSelect>
    </Field>
  );
}
