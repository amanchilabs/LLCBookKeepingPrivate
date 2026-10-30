import { describe, expect, it } from 'vitest';
import { calculateSimpleInterestCents } from '../src/loan-interest';

describe('simple interest on dated advances', () => {
  it('does not accrue interest before an advance is funded', () => {
    expect(calculateSimpleInterestCents({
      advances: [{ date: '2026-01-01', cents: 4_200_000n }],
      repayments: [],
      annualRate: '0.10',
      from: '2025-12-01',
      through: '2025-12-31',
      dayCount: 'ACT/365F',
    })).toBe(0n);
  });

  it('accrues simple interest only on funded principal, rounding once at output', () => {
    expect(calculateSimpleInterestCents({
      advances: [{ date: '2024-01-01', cents: 4_200_000n }],
      repayments: [],
      annualRate: '0.10',
      from: '2024-01-01',
      through: '2024-01-11',
      dayCount: 'ACT/365F',
    })).toBe(11507n);
  });

  it('applies repayment day exclusion before same-day advance inclusion', () => {
    expect(calculateSimpleInterestCents({
      advances: [{ date: '2024-01-01', cents: 4_200_000n }],
      repayments: [{ date: '2024-01-06', cents: 4_200_000n }],
      annualRate: '0.10',
      from: '2024-01-01',
      through: '2024-01-11',
      dayCount: 'ACT/365F',
    })).toBe(5753n);
  });
});
