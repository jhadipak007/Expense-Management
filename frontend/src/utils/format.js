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

const MONEY = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Show an API amount string with its currency code, e.g. "INR 12,450.00". */
export function formatMoney(amount, currency) {
  return `${currency} ${MONEY.format(amount)}`;
}

/** Up to two initials from a display name, e.g. "Priya Sharma" -> "PS". */
export function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}
