/**
 * Dashboard filters live in the URL: `from` and `to` ("YYYY-MM-DD", inclusive)
 * and repeated `category` ids. No categories means all of them.
 */
import { formatIsoDate } from '@/utils/format.js';

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

/** The inclusive range of a preset, in the browser's local calendar. */
export function presetRange(key, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  if (key === 'this-year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  const first = key === 'last-month' ? month - 1 : month;
  return { from: toIso(new Date(year, first, 1)), to: toIso(new Date(year, first + 1, 0)) };
}

/** The preset whose range equals `from`-`to`, or "custom". */
export function matchingPreset({ from, to }, today = new Date()) {
  const preset = PRESETS.find(({ key }) => {
    const range = presetRange(key, today);
    return range.from === from && range.to === to;
  });
  return preset ? preset.key : 'custom';
}

/** Filters from the URL; a missing or invalid range falls back to this month. */
export function parseFilters(searchParams, today = new Date()) {
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const valid = ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to;
  const categoryIds = searchParams.getAll('category').map(Number).filter((id) => id > 0);
  return { ...(valid ? { from, to } : presetRange('this-month', today)), categoryIds };
}

export function toSearchParams({ from, to, categoryIds }) {
  const params = new URLSearchParams({ from, to });
  for (const id of categoryIds) params.append('category', id);
  return params;
}

/** e.g. "1 Sep 2026 – 30 Sep 2026 · Grocery, Trips". */
export function describeFilters({ from, to, categoryIds }, categories) {
  const names = categories.filter((c) => categoryIds.includes(c.id)).map((c) => c.name);
  const range = `${formatIsoDate(from)} – ${formatIsoDate(to)}`;
  return `${range} · ${names.length ? names.join(', ') : 'All categories'}`;
}
