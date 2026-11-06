// Bookkeeping-to-tax exchange v1.
//
// Canonical contract: docs/contracts/bookkeeping-tax-exchange-v1.schema.json.
// This module only copies already computed cash-basis book totals from an
// existing CashBasisReport into a versioned, lossless JSON record. It never
// recomputes journal totals, allocates activity, classifies tax treatment, or
// determines deductibility, tax basis or tax liability. No sync/import exists.
import type { CashBasisReport } from '../../../packages/storage-native/src/bookkeeping-store';
import { isValidDateRange } from './report-exports';

export const BOOKKEEPING_TAX_EXCHANGE_SCHEMA_VERSION = 1 as const;
export const BOOKKEEPING_TAX_EXCHANGE_PRODUCT = 'LLCBookKeepingPrivate' as const;
export const BOOKKEEPING_TAX_EXCHANGE_BASIS = 'cash' as const;
export const BOOKKEEPING_TAX_EXCHANGE_CURRENCY = 'USD' as const;
export const BOOKKEEPING_TAX_EXCHANGE_REVIEW_STATUS = 'unreviewed' as const;
export const BOOKKEEPING_TAX_EXCHANGE_TEXT_MAX_LENGTH = 200;

export const BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS = Object.freeze([
  'Book figures only, copied from a cash-basis bookkeeping report.',
  'Not a tax return, tax classification, deductibility determination, tax-basis determination, or tax liability estimate.',
  'Not reviewed by a CPA or tax preparer.',
  'No synchronization or import is implemented; sharing this record is an explicit user action.',
] as const);

export type BookkeepingTaxExchangeLimitations = typeof BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS;

/** Signed decimal integer string of cents (no leading zeros, no "-0"). */
export type ExchangeCentsString = string;

export interface BookkeepingTaxExchangeSourceV1 {
  businessId: string;
  businessName: string;
  reference: string;
}

export interface BookkeepingTaxExchangePeriodV1 {
  fromDate: string;
  throughDate: string;
}

export interface BookkeepingTaxExchangeTotalsV1 {
  incomeCents: ExchangeCentsString;
  expenseCents: ExchangeCentsString;
  netIncomeCents: ExchangeCentsString;
}

/** Serialized (wire) form of the v1 record. Cents are strings to stay lossless. */
export interface BookkeepingTaxExchangeV1 {
  schemaVersion: typeof BOOKKEEPING_TAX_EXCHANGE_SCHEMA_VERSION;
  product: typeof BOOKKEEPING_TAX_EXCHANGE_PRODUCT;
  basis: typeof BOOKKEEPING_TAX_EXCHANGE_BASIS;
  currency: typeof BOOKKEEPING_TAX_EXCHANGE_CURRENCY;
  source: BookkeepingTaxExchangeSourceV1;
  period: BookkeepingTaxExchangePeriodV1;
  reviewStatus: typeof BOOKKEEPING_TAX_EXCHANGE_REVIEW_STATUS;
  totals: BookkeepingTaxExchangeTotalsV1;
  limitations: string[];
}

export interface BookkeepingTaxExchangeTotalsBigInt {
  incomeCents: bigint;
  expenseCents: bigint;
  netIncomeCents: bigint;
}

export interface BuildBookkeepingTaxExchangeInput {
  /** Existing, already computed cash-basis report. Values are copied, never recomputed. */
  report: CashBasisReport;
  /** Period the caller requested; must equal the report's period exactly. */
  expectedPeriod: BookkeepingTaxExchangePeriodV1;
  source: BookkeepingTaxExchangeSourceV1;
}

export class BookkeepingTaxExchangeError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid bookkeeping-to-tax exchange record: ${issues.join('; ')}`);
    this.name = 'BookkeepingTaxExchangeError';
    this.issues = Object.freeze([...issues]);
  }
}

export type BookkeepingTaxExchangeValidation =
  | { ok: true; record: BookkeepingTaxExchangeV1 }
  | { ok: false; issues: string[] };

const CENTS_PATTERN = /^(?:0|-?[1-9][0-9]*)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

const TOP_LEVEL_KEYS = [
  'schemaVersion', 'product', 'basis', 'currency', 'source', 'period', 'reviewStatus', 'totals', 'limitations',
] as const;
const SOURCE_KEYS = ['businessId', 'businessName', 'reference'] as const;
const PERIOD_KEYS = ['fromDate', 'throughDate'] as const;
const TOTALS_KEYS = ['incomeCents', 'expenseCents', 'netIncomeCents'] as const;

export const BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS = Object.freeze({
  topLevel: TOP_LEVEL_KEYS,
  source: SOURCE_KEYS,
  period: PERIOD_KEYS,
  totals: TOTALS_KEYS,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function checkExactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(`${path}${key} is not a supported field`);
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) issues.push(`${path}${key} is required`);
  }
}

export function isValidExchangeText(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && [...value].length <= BOOKKEEPING_TAX_EXCHANGE_TEXT_MAX_LENGTH
    && !CONTROL_CHARACTER_PATTERN.test(value);
}

export function isValidExchangeDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value) && isValidDateRange(value, value);
}

export function isValidExchangeCents(value: unknown): value is ExchangeCentsString {
  return typeof value === 'string' && CENTS_PATTERN.test(value);
}

/** Converts a validated cents string to bigint without any floating-point step. */
export function exchangeCentsToBigInt(value: ExchangeCentsString): bigint {
  if (!isValidExchangeCents(value)) throw new BookkeepingTaxExchangeError(['cents value must be a decimal integer string']);
  return BigInt(value);
}

/** Converts bigint cents to the canonical string form. Rejects numbers and other types. */
export function bigIntToExchangeCents(value: bigint): ExchangeCentsString {
  if (typeof value !== 'bigint') throw new BookkeepingTaxExchangeError(['cents value must be a bigint']);
  return value.toString(10);
}

function validateSource(value: unknown, issues: string[]): void {
  if (!isPlainObject(value)) {
    issues.push('source must be an object');
    return;
  }
  checkExactKeys(value, SOURCE_KEYS, 'source.', issues);
  for (const key of SOURCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key) && !isValidExchangeText(value[key])) {
      issues.push(`source.${key} must be trimmed non-empty text up to ${BOOKKEEPING_TAX_EXCHANGE_TEXT_MAX_LENGTH} characters without control characters`);
    }
  }
}

function validatePeriod(value: unknown, issues: string[]): void {
  if (!isPlainObject(value)) {
    issues.push('period must be an object');
    return;
  }
  checkExactKeys(value, PERIOD_KEYS, 'period.', issues);
  let datesValid = true;
  for (const key of PERIOD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      datesValid = false;
    } else if (!isValidExchangeDate(value[key])) {
      datesValid = false;
      issues.push(`period.${key} must be a real calendar date in YYYY-MM-DD format`);
    }
  }
  if (datesValid && !isValidDateRange(value.fromDate as string, value.throughDate as string)) {
    issues.push('period.fromDate must be on or before period.throughDate');
  }
}

function validateTotals(value: unknown, issues: string[]): void {
  if (!isPlainObject(value)) {
    issues.push('totals must be an object');
    return;
  }
  checkExactKeys(value, TOTALS_KEYS, 'totals.', issues);
  for (const key of TOTALS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key) && !isValidExchangeCents(value[key])) {
      issues.push(`totals.${key} must be a decimal integer string of cents`);
    }
  }
}

function validateLimitations(value: unknown, issues: string[]): void {
  const expected = BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS;
  if (!Array.isArray(value)
    || value.length !== expected.length
    || value.some((entry, index) => entry !== expected[index])) {
    issues.push('limitations must equal the fixed v1 limitation statements');
  }
}

/** Fail-closed structural and semantic validation of an untrusted value. */
export function validateBookkeepingTaxExchange(value: unknown): BookkeepingTaxExchangeValidation {
  const issues: string[] = [];
  if (!isPlainObject(value)) return { ok: false, issues: ['record must be a JSON object'] };

  if (Object.prototype.hasOwnProperty.call(value, 'schemaVersion')
    && value.schemaVersion !== BOOKKEEPING_TAX_EXCHANGE_SCHEMA_VERSION) {
    // Unknown versions are rejected outright; their semantics cannot be assumed.
    return { ok: false, issues: ['schemaVersion is not supported; only version 1 is accepted'] };
  }
  checkExactKeys(value, TOP_LEVEL_KEYS, '', issues);
  if ('product' in value && value.product !== BOOKKEEPING_TAX_EXCHANGE_PRODUCT) issues.push('product must be LLCBookKeepingPrivate');
  if ('basis' in value && value.basis !== BOOKKEEPING_TAX_EXCHANGE_BASIS) issues.push('basis must be cash');
  if ('currency' in value && value.currency !== BOOKKEEPING_TAX_EXCHANGE_CURRENCY) issues.push('currency must be USD');
  if ('reviewStatus' in value && value.reviewStatus !== BOOKKEEPING_TAX_EXCHANGE_REVIEW_STATUS) issues.push('reviewStatus must be unreviewed');
  if ('source' in value) validateSource(value.source, issues);
  if ('period' in value) validatePeriod(value.period, issues);
  if ('totals' in value) validateTotals(value.totals, issues);
  if ('limitations' in value) validateLimitations(value.limitations, issues);

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, record: canonicalCopy(value as unknown as BookkeepingTaxExchangeV1) };
}

export function assertBookkeepingTaxExchange(value: unknown): BookkeepingTaxExchangeV1 {
  const result = validateBookkeepingTaxExchange(value);
  if (!result.ok) throw new BookkeepingTaxExchangeError(result.issues);
  return result.record;
}

function canonicalCopy(record: BookkeepingTaxExchangeV1): BookkeepingTaxExchangeV1 {
  return {
    schemaVersion: record.schemaVersion,
    product: record.product,
    basis: record.basis,
    currency: record.currency,
    source: {
      businessId: record.source.businessId,
      businessName: record.source.businessName,
      reference: record.source.reference,
    },
    period: { fromDate: record.period.fromDate, throughDate: record.period.throughDate },
    reviewStatus: record.reviewStatus,
    totals: {
      incomeCents: record.totals.incomeCents,
      expenseCents: record.totals.expenseCents,
      netIncomeCents: record.totals.netIncomeCents,
    },
    limitations: [...record.limitations],
  };
}

/**
 * Builds a v1 record by copying an existing CashBasisReport exactly.
 * Fails closed when the report period does not match the requested period,
 * when amounts are not bigint, or when any field is invalid.
 */
export function buildBookkeepingTaxExchange(input: BuildBookkeepingTaxExchangeInput): BookkeepingTaxExchangeV1 {
  const { report, expectedPeriod, source } = input;
  const issues: string[] = [];
  if (!isPlainObject(report as unknown)) {
    throw new BookkeepingTaxExchangeError(['report must be a cash-basis report object']);
  }
  if (!isPlainObject(expectedPeriod as unknown)) {
    throw new BookkeepingTaxExchangeError(['expectedPeriod must be an object']);
  }
  if (report.fromDate !== expectedPeriod.fromDate || report.throughDate !== expectedPeriod.throughDate) {
    issues.push('report period does not match the requested period');
  }
  for (const key of TOTALS_KEYS) {
    if (typeof report[key] !== 'bigint') issues.push(`report.${key} must be bigint cents`);
  }
  if (issues.length > 0) throw new BookkeepingTaxExchangeError(issues);

  return assertBookkeepingTaxExchange({
    schemaVersion: BOOKKEEPING_TAX_EXCHANGE_SCHEMA_VERSION,
    product: BOOKKEEPING_TAX_EXCHANGE_PRODUCT,
    basis: BOOKKEEPING_TAX_EXCHANGE_BASIS,
    currency: BOOKKEEPING_TAX_EXCHANGE_CURRENCY,
    source: isPlainObject(source as unknown)
      ? { businessId: source.businessId, businessName: source.businessName, reference: source.reference }
      : source,
    period: { fromDate: report.fromDate, throughDate: report.throughDate },
    reviewStatus: BOOKKEEPING_TAX_EXCHANGE_REVIEW_STATUS,
    totals: {
      incomeCents: bigIntToExchangeCents(report.incomeCents),
      expenseCents: bigIntToExchangeCents(report.expenseCents),
      netIncomeCents: bigIntToExchangeCents(report.netIncomeCents),
    },
    limitations: [...BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS],
  });
}

/** Serializes a validated record to deterministic, pretty-printed JSON. */
export function serializeBookkeepingTaxExchange(record: BookkeepingTaxExchangeV1): string {
  return `${JSON.stringify(assertBookkeepingTaxExchange(record), null, 2)}\n`;
}

/** Parses and validates serialized JSON. Throws BookkeepingTaxExchangeError on any problem. */
export function parseBookkeepingTaxExchange(json: string): BookkeepingTaxExchangeV1 {
  if (typeof json !== 'string') throw new BookkeepingTaxExchangeError(['input must be a JSON string']);
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new BookkeepingTaxExchangeError(['input is not valid JSON']);
  }
  return assertBookkeepingTaxExchange(value);
}

/** Returns the record's book totals as bigint cents (copied values, no recomputation). */
export function bookkeepingTaxExchangeTotals(record: BookkeepingTaxExchangeV1): BookkeepingTaxExchangeTotalsBigInt {
  const validated = assertBookkeepingTaxExchange(record);
  return {
    incomeCents: exchangeCentsToBigInt(validated.totals.incomeCents),
    expenseCents: exchangeCentsToBigInt(validated.totals.expenseCents),
    netIncomeCents: exchangeCentsToBigInt(validated.totals.netIncomeCents),
  };
}
