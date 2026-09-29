import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Label } from '@/components/ui/label';

/** A fieldset of radios or checkboxes under a legend. */
export default function OptionGroup({ legend, children }) {
  return (
    <FieldSet className="gap-1">
      <FieldLegend className="mb-1 font-semibold text-foreground">{legend}</FieldLegend>
      {children}
    </FieldSet>
  );
}

/** One radio or checkbox (`children`) with its label, in a row at least 44px tall. */
export function Option({ id, label, children }) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      {children}
      <Label htmlFor={id} className="text-base font-normal">
        {label}
      </Label>
    </div>
  );
}
