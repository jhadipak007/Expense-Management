/**
 * Dashboard filters live in the URL: `from` and `to` ("YYYY-MM-DD", inclusive)
 * and repeated `category` ids. No categories means all of them.
 */
import { formatPeriod } from '@/utils/format.js';

export const PRESETS = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'this-year', label: 'This year' },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The inclusive range of a preset, in the browser's local calendar. Months start on
 * `monthStartDay` (1 to 28) and end the day before it next month, like monthly budgets.
 */
export function presetRange(key, monthStartDay, today = new Date()) {
  const year = today.getFullYear();
  if (key === 'this-year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  // Date counts month -1 as December of the year before, and day 0 as the month's last day.
  const thisMonth = today.getDate() >= monthStartDay ? today.getMonth() : today.getMonth() - 1;
  const month = key === 'last-month' ? thisMonth - 1 : thisMonth;
  return {
    from: toIso(new Date(year, month, monthStartDay)),
    to: toIso(new Date(year, month + 1, monthStartDay - 1)),
  };
}

/** The preset whose range equals `from`-`to`, or "custom". */
export function matchingPreset({ from, to }, monthStartDay, today = new Date()) {
  const preset = PRESETS.find(({ key }) => {
    const range = presetRange(key, monthStartDay, today);
    return range.from === from && range.to === to;
  });
  return preset ? preset.key : 'custom';
}

/** Filters from the URL; a missing or invalid range falls back to this month. */
export function parseFilters(searchParams, monthStartDay, today = new Date()) {
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const valid = ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to;
  const categoryIds = searchParams.getAll('category').map(Number).filter((id) => id > 0);
  return { ...(valid ? { from, to } : presetRange('this-month', monthStartDay, today)), categoryIds };
}

export function toSearchParams({ from, to, categoryIds }) {
  const params = new URLSearchParams({ from, to });
  for (const id of categoryIds) params.append('category', id);
  return params;
}

/** e.g. "15 Sep – 14 Oct 2026 · Grocery, Trips". */
export function describeFilters({ from, to, categoryIds }, categories) {
  const names = categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.name);
  return `${formatPeriod(from, to)} · ${names.length ? names.join(', ') : 'All categories'}`;
}
