/** Budget periods in display order, as `[value, label]`. */
export const PERIODS = [
  ['weekly', 'Weekly'],
  ['fortnightly', 'Fortnightly'],
  ['monthly', 'Monthly'],
  ['yearly', 'Yearly'],
];

export const PERIOD_LABELS = Object.fromEntries(PERIODS);

/** Each status has a text label and its own colour, so colour is never the only signal. */
export const STATUSES = {
  on_track: { label: 'On track', badge: 'bg-success text-white', bar: 'bg-success' },
  close: { label: 'Close to limit', badge: 'bg-accent text-brand-deep', bar: 'bg-accent' },
  over: { label: 'Over budget', badge: 'bg-destructive text-white', bar: 'bg-destructive' },
};

/** The budget's category name, or "All categories". */
export function categoryName(budget, categories) {
  return categories.find((c) => c.id === budget.category_id)?.name ?? 'All categories';
}
