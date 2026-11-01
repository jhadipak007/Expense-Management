import { FieldLegend, FieldSet } from '@/components/ui/field';

/** A titled group of related form fields, separated from the next by a rule. */
export default function FormSection({ legend, children }) {
  return (
    <FieldSet className="gap-4 border-b pb-6">
      <FieldLegend className="mb-0 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {legend}
      </FieldLegend>
      {children}
    </FieldSet>
  );
}
