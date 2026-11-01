import { describe, expect, it } from 'vitest';
import { formatPeriod, ordinal } from './format.js';

describe('formatPeriod', () => {
  it('shows the year once when the period is within one year', () => {
    expect(formatPeriod('2026-09-15', '2026-10-14')).toBe('15 Sep – 14 Oct 2026');
  });

  it('shows both years when the period crosses a new year', () => {
    expect(formatPeriod('2026-12-15', '2027-01-14')).toBe('15 Dec 2026 – 14 Jan 2027');
  });
});

describe('ordinal', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'], [28, '28th']])('%i is %s', (day, text) => {
    expect(ordinal(day)).toBe(text);
  });
});
