/** Show an ISO timestamp as a short local date, e.g. "5 Oct 2026". */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const ROLE_LABELS = { owner: 'Owner', member: 'Member' };

/** Today's local date as "YYYY-MM-DD", the value format of a date input. */
export function todayIso() {
  return new Date().toLocaleDateString('en-CA');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Show a "YYYY-MM-DD" date as "1 Sep 2026", without time zone shifts. */
export function formatIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Show an inclusive date range, e.g. "15 Sep – 14 Oct 2026", or "20 Dec 2026 – 2 Jan 2027". */
export function formatPeriod(start, end) {
  const [first, last] = [formatIsoDate(start), formatIsoDate(end)];
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${sameYear ? first.slice(0, -5) : first} – ${last}`;
}

/** A day of the month as "1st", "2nd", "3rd", "4th" ... "11th", "12th", "13th" ... "21st". */
export function ordinal(day) {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
  return `${day}${suffix}`;
}

const MONEY = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Show an amount with two decimals and thousands separators, e.g. "12,450.00". */
export function formatAmount(amount) {
  return MONEY.format(amount);
}

/** Show an API amount string with its currency code, e.g. "INR 12,450.00". */
export function formatMoney(amount, currency) {
  return `${currency} ${formatAmount(amount)}`;
}

/** Up to two initials from a display name, e.g. "Priya Sharma" -> "PS". */
export function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

/** Show a UTC timestamp in the viewer's time zone, e.g. "2 Nov 2026, 5:07 pm". */
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
