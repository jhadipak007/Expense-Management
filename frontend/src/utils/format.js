/** Show an ISO timestamp as a short local date, e.g. "5 Oct 2026". */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const ROLE_LABELS = { owner: 'Owner', member: 'Member' };
