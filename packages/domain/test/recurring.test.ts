import { describe, expect, it } from 'vitest';
import { nextRecurringDate } from '../src/recurring';

describe('nextRecurringDate', () => {
  it('advances weekly schedules across a year boundary', () => {
    expect(nextRecurringDate('2024-12-27', 'weekly')).toBe('2025-01-03');
  });

  it('clamps month ends without losing the original day anchor', () => {
    expect(nextRecurringDate('2024-01-31', 'monthly', 31)).toBe('2024-02-29');
    expect(nextRecurringDate('2024-02-29', 'monthly', 31)).toBe('2024-03-31');
  });

  it('advances quarterly schedules by three months', () => {
    expect(nextRecurringDate('2025-11-30', 'quarterly', 30)).toBe('2026-02-28');
    expect(nextRecurringDate('2026-02-28', 'quarterly', 30)).toBe('2026-05-30');
  });

  it('keeps a leap-day yearly schedule anchored to February 29', () => {
    expect(nextRecurringDate('2024-02-29', 'yearly', 29)).toBe('2025-02-28');
    expect(nextRecurringDate('2025-02-28', 'yearly', 29)).toBe('2026-02-28');
  });

  it('rejects invalid dates, intervals, and day anchors', () => {
    expect(() => nextRecurringDate('2024-02-30', 'monthly')).toThrow('valid recurring date');
    expect(() => nextRecurringDate('2024-01-01', 'daily' as never)).toThrow('Choose a supported recurrence');
    expect(() => nextRecurringDate('2024-01-01', 'monthly', 32)).toThrow('day anchor');
  });
});
