import { describe, expect, it } from 'vitest';
import { formatPeriod } from './format.js';

describe('formatPeriod', () => {
  it('shows the year once when the period is within one year', () => {
    expect(formatPeriod('2026-09-15', '2026-10-14')).toBe('15 Sep – 14 Oct 2026');
  });

  it('shows both years when the period crosses a new year', () => {
    expect(formatPeriod('2026-12-15', '2027-01-14')).toBe('15 Dec 2026 – 14 Jan 2027');
  });
});
