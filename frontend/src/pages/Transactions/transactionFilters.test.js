import { describe, expect, it } from 'vitest';
import {
  changeFilters, clearFilters, hasActiveFilters, parseFilters, toApiParams, toSearchParams,
} from './transactionFilters.js';

const parse = (query) => parseFilters(new URLSearchParams(query));

describe('transaction filters', () => {
  it('defaults to the first page of personal transactions with no filters', () => {
    expect(parse('')).toEqual({
      space: null, view: 'list', from: '', to: '', categoryIds: [], member: null, q: '', actions: [], page: 1,
    });
  });

  it('round-trips through the URL', () => {
    const query = 'space=4&view=audit&from=2026-09-01&to=2026-09-30&category=1&category=3&member=7&q=milk&action=deleted&page=2';
    expect(toSearchParams(parse(query)).toString()).toBe(query);
  });

  it('drops invalid values and a reversed date range', () => {
    expect(parse('space=x&from=2026-9-1&category=0&action=edited&page=-2&member=abc')).toEqual(parse(''));
    expect(parse('from=2026-09-30&to=2026-09-01')).toMatchObject({ from: '', to: '' });
  });

  it('keeps actions in the URL only for the audit log', () => {
    expect(toSearchParams(parse('action=created')).toString()).toBe('');
  });

  it('returns to page 1 on a change and drops the member with the space', () => {
    const filters = parse('space=4&member=7&page=3');
    expect(changeFilters(filters, { q: 'tea' })).toMatchObject({ page: 1, member: 7 });
    expect(changeFilters(filters, { space: 5 })).toMatchObject({ space: 5, member: null, page: 1 });
  });

  it('clears everything but the space and view', () => {
    const filters = parse('space=4&view=audit&q=tea&action=created&page=2');
    expect(hasActiveFilters(filters)).toBe(true);
    expect(clearFilters(filters)).toEqual({ ...parse(''), space: 4, view: 'audit' });
    expect(hasActiveFilters(clearFilters(filters))).toBe(false);
  });

  it('builds API parameters with the page offset', () => {
    expect(toApiParams(parse('space=4&member=7&category=2&q=%20tea%20&page=3'))).toEqual({
      family_id: 4, date_from: '', date_to: '', category_id: [2], user_id: 7, q: 'tea', limit: 25, offset: 50,
    });
    expect(toApiParams(parse('view=audit&action=created'))).toMatchObject({ action: ['created'], family_id: null });
  });
});
