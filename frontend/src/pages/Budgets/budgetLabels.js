/** Category value meaning a budget covers every category (sent to the API as null). */
export const ALL = 'all';

/** Budget periods in display order, as `[value, label]`. */
export const PERIODS = [
  ['weekly', 'Weekly'],
  ['fortnightly', 'Fortnightly'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
];

export const PERIOD_LABELS = Object.fromEntries(PERIODS);

/**
 * Each status has a text label and its own colour, so colour is never the only signal.
 * Badges use a tint with foreground text, which keeps AA contrast in both themes.
 */
export const STATUSES = {
  on_track: { label: 'On track', badge: 'border-success bg-success/15 text-foreground', bar: 'bg-success' },
  close: { label: 'Close to limit', badge: 'border-accent bg-accent/25 text-foreground', bar: 'bg-accent' },
  over: { label: 'Over budget', badge: 'border-destructive bg-destructive/15 text-foreground', bar: 'bg-destructive' },
};

/** The budget's category name, or "All categories". */
export function categoryName(budget, categories) {
  return categories.find((c) => c.id === budget.category_id)?.name ?? 'All categories';
}
