import Decimal from 'decimal.js';

export interface DatedAmount {
  date: string;
  cents: bigint;
}

export interface InterestInput {
  advances: readonly DatedAmount[];
  repayments: readonly DatedAmount[];
  annualRate: string;
  from: string;
  through: string;
  dayCount: 'ACT/365F' | 'ACT/ACT';
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
