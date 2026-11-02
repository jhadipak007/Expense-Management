import { CheckIcon } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

/**
 * Category filter chips: "All categories" plus one chip per category.
 * `selected` holds the chosen ids (none means all); `onChange(ids)` gets the new choice.
 */
export default function CategoryChips({ categories, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
      <Chip label="All categories" pressed={selected.length === 0} onPressedChange={() => onChange([])} />
      {categories.map((category) => (
        <Chip
          key={category.id} label={category.name} color={category.color}
          pressed={selected.includes(category.id)} onPressedChange={() => toggle(category.id)}
        />
      ))}
    </div>
  );
}

/** A pill that toggles one category filter; a check marks it on, a colour dot names the category's colour. */
function Chip({ label, color, pressed, onPressedChange }) {
  return (
    <Toggle
      variant="outline" pressed={pressed} onPressedChange={onPressedChange}
      className="rounded-full data-[state=on]:border-primary"
    >
      {pressed && <CheckIcon aria-hidden="true" />}
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />}
      {label}
    </Toggle>
  );
}
