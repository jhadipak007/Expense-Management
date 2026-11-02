/**
 * Transactions page state lives in the URL:
 * `space` (a family id; absent means Personal), `view` (`audit` for the audit log),
 * `from` and `to` (inclusive expense dates), repeated `category`, `member`, `q`,
 * repeated `action` (audit log only) and `page` (from 1).
 */
export const PAGE_SIZE = 25;
export const ACTIONS = ['created', 'updated', 'deleted', 'restored'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const positive = (value) => (Number(value) > 0 ? Number(value) : null);

/** Filters from the URL; invalid values, and a From date after the To date, are dropped. */
export function parseFilters(searchParams) {
  const date = (key) => (ISO_DATE.test(searchParams.get(key) ?? '') ? searchParams.get(key) : '');
  const [from, to] = [date('from'), date('to')];
  const ordered = !from || !to || from <= to;
  return {
    space: positive(searchParams.get('space')),
    view: searchParams.get('view') === 'audit' ? 'audit' : 'list',
    from: ordered ? from : '',
    to: ordered ? to : '',
    categoryIds: searchParams.getAll('category').map(Number).filter((id) => id > 0),
    member: positive(searchParams.get('member')),
    q: searchParams.get('q') ?? '',
    actions: searchParams.getAll('action').filter((action) => ACTIONS.includes(action)),
    page: positive(searchParams.get('page')) ?? 1,
  };
}

export function toSearchParams(filters) {
  const params = new URLSearchParams();
  if (filters.space) params.set('space', filters.space);
  if (filters.view === 'audit') params.set('view', 'audit');
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  for (const id of filters.categoryIds) params.append('category', id);
  if (filters.member) params.set('member', filters.member);
  if (filters.q) params.set('q', filters.q);
  if (filters.view === 'audit') for (const action of filters.actions) params.append('action', action);
  if (filters.page > 1) params.set('page', filters.page);
  return params;
}

/**
 * The filters after a change: any change but paging returns to page 1, and a
 * new space drops the member filter, which belongs to the old space.
 */
export function changeFilters(filters, change) {
  const next = { ...filters, page: 1, ...change };
  if ('space' in change && change.space !== filters.space) next.member = null;
  return next;
}

/** The filters with the space, view and nothing else. */
export function clearFilters({ space, view }) {
  return { ...parseFilters(new URLSearchParams()), space, view };
}

export function hasActiveFilters(filters) {
  return Boolean(filters.from || filters.to || filters.categoryIds.length || filters.member
    || filters.q || (filters.view === 'audit' && filters.actions.length));
}

/** API query parameters for the current page. */
export function toApiParams(filters) {
  return {
    family_id: filters.space,
    date_from: filters.from,
    date_to: filters.to,
    category_id: filters.categoryIds,
    user_id: filters.space ? filters.member : null,
    q: filters.q.trim(),
    ...(filters.view === 'audit' && { action: filters.actions }),
    limit: PAGE_SIZE,
    offset: (filters.page - 1) * PAGE_SIZE,
  };
}
