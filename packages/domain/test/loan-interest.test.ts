import { describe, expect, it } from 'vitest';
import {
  annualRateFromBasisPoints,
  calculateSimpleInterestCents,
  calculateUnpaidLoanInterestCents,
  parseAnnualRatePercent,
  summarizeLoanBalance,
} from '../src/loan-interest';

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

  it('converts contract basis points into an exact decimal rate', () => {
    expect(annualRateFromBasisPoints(0)).toBe('0');
    expect(annualRateFromBasisPoints(725)).toBe('0.0725');
    expect(annualRateFromBasisPoints(10_000)).toBe('1');
    expect(() => annualRateFromBasisPoints(1.5)).toThrow('whole basis points');
    expect(() => annualRateFromBasisPoints(-1)).toThrow('non-negative');
  });

  it('parses a contract percentage to whole basis points without floating point', () => {
    expect(parseAnnualRatePercent('7.25')).toBe(725);
    expect(parseAnnualRatePercent('0.01')).toBe(1);
    expect(parseAnnualRatePercent('1000')).toBe(100_000);
    expect(() => parseAnnualRatePercent('7.251')).toThrow('two decimal places');
    expect(() => parseAnnualRatePercent('1000.01')).toThrow('1000.00%');
    expect(() => parseAnnualRatePercent('-1.00')).toThrow('non-negative');
  });

  it('calculates unpaid interest from multiple dated advances and principal reductions', () => {
    const advances = [
      { date: '2024-01-01', cents: 50_000n },
      { date: '2024-01-11', cents: 50_000n },
    ];
    const januaryDue = calculateUnpaidLoanInterestCents({
      advances,
      principalRepayments: [],
      interestRepayments: [],
      annualRateBasisPoints: 1_000,
      repaymentDate: '2024-01-21',
      dayCount: 'ACT/365F',
    });
    expect(januaryDue).toBe(411n);

    expect(calculateUnpaidLoanInterestCents({
      advances,
      principalRepayments: [{ date: '2024-01-21', cents: 10_000n }],
      interestRepayments: [{ date: '2024-01-21', cents: 411n }],
      annualRateBasisPoints: 1_000,
      repaymentDate: '2024-02-20',
      dayCount: 'ACT/365F',
    })).toBe(740n);
  });

  it('uses ACT/ACT leap-year days and rounds half a cent upward', () => {
    expect(calculateSimpleInterestCents({
      advances: [{ date: '2024-02-28', cents: 100_000_000n }],
      repayments: [],
      annualRate: '0.1',
      from: '2024-02-28',
      through: '2024-03-01',
      dayCount: 'ACT/ACT ISDA',
    })).toBe(54_645n);
    expect(calculateSimpleInterestCents({
      advances: [{ date: '2023-12-31', cents: 366_000n }],
      repayments: [],
      annualRate: '0.1',
      from: '2023-12-31',
      through: '2024-01-02',
      dayCount: 'ACT/ACT ISDA',
    })).toBe(200n);
    expect(calculateSimpleInterestCents({
      advances: [{ date: '2024-01-01', cents: 365n }],
      repayments: [],
      annualRate: '0.5',
      from: '2024-01-01',
      through: '2024-01-02',
      dayCount: 'ACT/365F',
    })).toBe(1n);
  });

  it('rejects ambiguous ACT/ACT because only the ISDA convention is implemented', () => {
    expect(() => calculateSimpleInterestCents({
      advances: [{ date: '2024-01-01', cents: 100_000n }],
      repayments: [],
      annualRate: '0.1',
      from: '2024-01-01',
      through: '2024-01-02',
      dayCount: 'ACT/ACT' as never,
    })).toThrow('ACT/ACT ISDA');
  });

  it('summarizes commitment, principal, and unpaid interest through the selected date', () => {
    expect(summarizeLoanBalance({
      commitmentCents: 100_000n,
      annualRateBasisPoints: 1_000,
      dayCount: 'ACT/365F',
      asOfDate: '2024-02-20',
      activities: [
        { date: '2024-01-01', kind: 'advance', amountCents: 50_000n, principalCents: 0n, interestCents: 0n },
        { date: '2024-01-11', kind: 'advance', amountCents: 50_000n, principalCents: 0n, interestCents: 0n },
        { date: '2024-01-21', kind: 'repayment', amountCents: -10_411n, principalCents: 10_000n, interestCents: 411n },
        { date: '2024-02-20', kind: 'repayment', amountCents: -740n, principalCents: 0n, interestCents: 740n },
        { date: '2024-03-01', kind: 'repayment', amountCents: -90_000n, principalCents: 90_000n, interestCents: 0n },
      ],
    })).toEqual({
      totalAdvancesCents: 100_000n,
      commitmentRemainingCents: 0n,
      principalRepaidCents: 10_000n,
      principalOutstandingCents: 90_000n,
      interestAccruedCents: 1_175n,
      interestPaidCents: 1_151n,
      interestOutstandingCents: 24n,
    });
  });
});
