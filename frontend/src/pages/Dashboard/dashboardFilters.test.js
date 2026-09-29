import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/test/handlers.js';
import {
  describeFilters, matchingPreset, parseFilters, presetRange, toSearchParams,
} from './dashboardFilters.js';

const SEP_15 = new Date(2026, 8, 15);
const JAN_10 = new Date(2027, 0, 10);

describe('dashboard filters', () => {
  it.each([
    ['this-month', SEP_15, { from: '2026-09-01', to: '2026-09-30' }],
    ['last-month', SEP_15, { from: '2026-08-01', to: '2026-08-31' }],
    ['this-year', SEP_15, { from: '2026-01-01', to: '2026-12-31' }],
    ['last-month', JAN_10, { from: '2026-12-01', to: '2026-12-31' }],
    ['this-month', new Date(2028, 1, 3), { from: '2028-02-01', to: '2028-02-29' }],
  ])('%s on %s', (key, today, range) => {
    expect(presetRange(key, today)).toEqual(range);
  });

  it('recognises a preset range and calls anything else custom', () => {
    expect(matchingPreset({ from: '2026-08-01', to: '2026-08-31' }, SEP_15)).toBe('last-month');
    expect(matchingPreset({ from: '2026-09-02', to: '2026-09-30' }, SEP_15)).toBe('custom');
  });

  it('defaults to this month and all categories', () => {
    expect(parseFilters(new URLSearchParams(), SEP_15)).toEqual({
      from: '2026-09-01', to: '2026-09-30', categoryIds: [],
    });
  });

  it.each(['from=2026-09-30&to=2026-09-01', 'from=abc&to=2026-09-01', 'from=2026-09-01'])(
    'ignores an invalid range: %s', (query) => {
      expect(parseFilters(new URLSearchParams(query), SEP_15)).toMatchObject({
        from: '2026-09-01', to: '2026-09-30',
      });
    },
  );

  it('round-trips through the URL', () => {
    const filters = { from: '2026-09-05', to: '2026-09-10', categoryIds: [1, 3] };
    expect(parseFilters(toSearchParams(filters))).toEqual(filters);
  });

  it('describes the range and chosen categories', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' };
    expect(describeFilters({ ...range, categoryIds: [1, 3] }, CATEGORIES))
      .toBe('1 Sep 2026 – 30 Sep 2026 · Grocery, Trips');
    expect(describeFilters({ ...range, categoryIds: [] }, CATEGORIES))
      .toBe('1 Sep 2026 – 30 Sep 2026 · All categories');
  });
});
