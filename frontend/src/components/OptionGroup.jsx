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

/** One radio or checkbox (`children`) and its text, in a label that is a 44px tap target. */
export function Option({ label, children }) {
  return (
    <Label className="min-h-11 cursor-pointer text-base font-normal">
      {children}
      {label}
    </Label>
  );
}
