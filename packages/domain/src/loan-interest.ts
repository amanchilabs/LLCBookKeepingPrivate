import Decimal from 'decimal.js';

export interface DatedAmount {
  date: string;
  cents: bigint;
}

export type LoanDayCount = 'ACT/365F' | 'ACT/ACT ISDA';

export interface InterestInput {
  advances: readonly DatedAmount[];
  repayments: readonly DatedAmount[];
  annualRate: string;
  from: string;
  through: string;
  dayCount: LoanDayCount;
}

export interface UnpaidLoanInterestInput {
  advances: readonly DatedAmount[];
  principalRepayments: readonly DatedAmount[];
  interestRepayments: readonly DatedAmount[];
  annualRateBasisPoints: number;
  repaymentDate: string;
  dayCount: LoanDayCount;
}

export interface LoanBalanceActivity {
  date: string;
  kind: 'advance' | 'repayment';
  amountCents: bigint;
  principalCents: bigint;
  interestCents: bigint;
}

export interface LoanBalanceInput {
  commitmentCents: bigint;
  annualRateBasisPoints: number;
  dayCount: LoanDayCount;
  asOfDate: string;
  activities: readonly LoanBalanceActivity[];
}

export interface LoanBalanceSummary {
  totalAdvancesCents: bigint;
  commitmentRemainingCents: bigint;
  principalRepaidCents: bigint;
  principalOutstandingCents: bigint;
  interestAccruedCents: bigint;
  interestPaidCents: bigint;
  interestOutstandingCents: bigint;
}

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error(`Invalid business date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== value) throw new Error(`Invalid business date: ${value}`);
  return date;
}

function dayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysInYear(year: number): number {
  return new Date(Date.UTC(year + 1, 0, 1)).getTime() - new Date(Date.UTC(year, 0, 1)).getTime() === 366 * 86_400_000 ? 366 : 365;
}

/** Convert a contract rate in 0.01% increments without binary floating-point arithmetic. */
export function annualRateFromBasisPoints(basisPoints: number): string {
  if (!Number.isSafeInteger(basisPoints)) throw new Error('Annual rate must use whole basis points.');
  if (basisPoints < 0) throw new Error('Annual rate must be non-negative.');
  if (basisPoints > 100_000) throw new Error('Annual rate cannot exceed 1000.00%.');
  const value = BigInt(basisPoints);
  const whole = value / 10_000n;
  const fraction = (value % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Parse a user-entered percentage into 0.01% basis points without floating point. */
export function parseAnnualRatePercent(text: string): number {
  const normalized = text.trim();
  if (normalized.startsWith('-')) throw new Error('Annual rate must be non-negative.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Enter an annual rate with no more than two decimal places.');
  const wholePercent = BigInt(match[1]);
  const fractionalPercent = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  const basisPoints = wholePercent * 100n + fractionalPercent;
  if (basisPoints > 100_000n) throw new Error('Annual rate cannot exceed 1000.00%.');
  return Number(basisPoints);
}

function validatePrincipalEvents(advances: readonly DatedAmount[], repayments: readonly DatedAmount[]): void {
  const events = [
    ...repayments.map((event) => ({ ...event, kind: 'repayment' as const })),
    ...advances.map((event) => ({ ...event, kind: 'advance' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'repayment' ? -1 : 1));
  let principal = 0n;
  for (const event of events) {
    parseDate(event.date);
    if (event.cents <= 0n) throw new Error('Loan events must be positive amounts.');
    if (event.kind === 'repayment') {
      if (event.cents > principal) throw new Error('Repayment exceeds principal outstanding at that event order.');
      principal -= event.cents;
    } else {
      principal += event.cents;
    }
  }
}

/**
 * Calculates non-compounding contractual interest over [from, through).
 * Each advance accrues on its date; repayments reduce principal before that
 * date accrues. Same-day repayments sort before advances. Rounding is once,
 * half-up, to whole USD cents at the result boundary.
 */
export function calculateSimpleInterestCents(input: InterestInput): bigint {
  if (input.dayCount !== 'ACT/365F' && input.dayCount !== 'ACT/ACT ISDA') {
    throw new Error('Choose ACT/365F or ACT/ACT ISDA to match the agreement; other day-count conventions are not supported.');
  }
  const from = parseDate(input.from);
  const through = parseDate(input.through);
  if (dayKey(through) < dayKey(from)) throw new Error('Interest period end precedes its start.');
  const rate = new Decimal(input.annualRate);
  if (!rate.isFinite() || rate.isNegative()) throw new Error('Annual rate must be a finite non-negative decimal.');
  validatePrincipalEvents(input.advances, input.repayments);

  const events = [
    ...input.repayments.map((event) => ({ ...event, kind: 'repayment' as const })),
    ...input.advances.map((event) => ({ ...event, kind: 'advance' as const })),
  ];
  const principalByDate = new Map<string, { repayments: bigint; advances: bigint }>();
  for (const event of events) {
    const current = principalByDate.get(event.date) ?? { repayments: 0n, advances: 0n };
    current[event.kind === 'repayment' ? 'repayments' : 'advances'] += event.cents;
    principalByDate.set(event.date, current);
  }

  let principal = 0n;
  let accrued = new Decimal(0);
  for (let millis = dayKey(from); millis < dayKey(through); millis += 86_400_000) {
    const date = new Date(millis);
    const key = date.toISOString().slice(0, 10);
    const dayEvents = principalByDate.get(key);
    if (dayEvents) {
      principal -= dayEvents.repayments;
      principal += dayEvents.advances;
    }
    const basis = input.dayCount === 'ACT/365F' ? 365 : daysInYear(date.getUTCFullYear());
    accrued = accrued.plus(new Decimal(principal.toString()).mul(rate).div(basis));
  }
  return BigInt(accrued.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
}

/**
 * Interest available to pay on a repayment date. The repayment date is excluded,
 * and prior interest payments reduce the rounded cumulative amount due.
 */
export function calculateUnpaidLoanInterestCents(input: UnpaidLoanInterestInput): bigint {
  const repaymentDay = parseDate(input.repaymentDate);
  const beforeRepayment = (event: DatedAmount) => dayKey(parseDate(event.date)) < dayKey(repaymentDay);
  const advances = input.advances.filter(beforeRepayment);
  if (advances.length === 0) return 0n;

  const principalRepayments = input.principalRepayments.filter(beforeRepayment);
  const interestPaid = input.interestRepayments.filter(beforeRepayment)
    .reduce((total, event) => {
      if (event.cents <= 0n) throw new Error('Loan interest payments must be positive amounts.');
      return total + event.cents;
    }, 0n);
  const from = advances.reduce((earliest, event) => event.date < earliest ? event.date : earliest, advances[0].date);
  const accrued = calculateSimpleInterestCents({
    advances,
    repayments: principalRepayments,
    annualRate: annualRateFromBasisPoints(input.annualRateBasisPoints),
    from,
    through: input.repaymentDate,
    dayCount: input.dayCount,
  });
  const unpaid = accrued - interestPaid;
  if (unpaid < 0n) throw new Error('Recorded interest payments exceed accrued interest on this repayment date.');
  return unpaid;
}

/** Calculate book balances and simple interest at the end of an inclusive local ledger date. */
export function summarizeLoanBalance(input: LoanBalanceInput): LoanBalanceSummary {
  const asOf = parseDate(input.asOfDate);
  const throughExclusive = new Date(dayKey(asOf) + 86_400_000).toISOString().slice(0, 10);
  if (input.commitmentCents <= 0n) throw new Error('Loan commitment must be positive.');
  const activities = input.activities.filter((activity) => {
    parseDate(activity.date);
    return activity.date <= input.asOfDate;
  });
  const advances = activities.filter((activity) => activity.kind === 'advance')
    .map((activity) => ({ date: activity.date, cents: activity.amountCents }));
  const principalRepayments = activities.filter((activity) => activity.kind === 'repayment' && activity.principalCents > 0n)
    .map((activity) => ({ date: activity.date, cents: activity.principalCents }));
  const interestRepayments = activities.filter((activity) => activity.kind === 'repayment' && activity.interestCents > 0n)
    .map((activity) => ({ date: activity.date, cents: activity.interestCents }));
  const totalAdvancesCents = advances.reduce((total, event) => total + event.cents, 0n);
  const principalRepaidCents = principalRepayments.reduce((total, event) => total + event.cents, 0n);
  const principalOutstandingCents = totalAdvancesCents - principalRepaidCents;
  if (totalAdvancesCents > input.commitmentCents) throw new Error('Funded loan advances exceed the commitment ceiling.');
  if (principalOutstandingCents < 0n) throw new Error('Loan principal repayments exceed funded advances.');
  const interestPaidCents = interestRepayments.reduce((total, event) => total + event.cents, 0n);

  let interestAccruedCents = 0n;
  if (advances.length > 0) {
    const from = advances.reduce((earliest, event) => event.date < earliest ? event.date : earliest, advances[0].date);
    interestAccruedCents = calculateSimpleInterestCents({
      advances,
      repayments: principalRepayments,
      annualRate: annualRateFromBasisPoints(input.annualRateBasisPoints),
      from,
      through: throughExclusive,
      dayCount: input.dayCount,
    });
  }
  const interestOutstandingCents = interestAccruedCents - interestPaidCents;
  if (interestOutstandingCents < 0n) throw new Error('Recorded interest payments exceed accrued interest through the selected date.');
  return {
    totalAdvancesCents,
    commitmentRemainingCents: input.commitmentCents - totalAdvancesCents,
    principalRepaidCents,
    principalOutstandingCents,
    interestAccruedCents,
    interestPaidCents,
    interestOutstandingCents,
  };
}
