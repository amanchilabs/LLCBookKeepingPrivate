import { describe, expect, it } from 'vitest';
import schema from '../../../docs/contracts/bookkeeping-tax-exchange-v1.schema.json';
import fixture from '../../../docs/contracts/bookkeeping-tax-exchange-v1.synthetic.json';
import type { CashBasisReport } from '../../../packages/storage-native/src/bookkeeping-store';
import {
  BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS,
  BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS,
  BookkeepingTaxExchangeError,
  type BookkeepingTaxExchangeV1,
  bigIntToExchangeCents,
  bookkeepingTaxExchangeTotals,
  buildBookkeepingTaxExchange,
  exchangeCentsToBigInt,
  parseBookkeepingTaxExchange,
  serializeBookkeepingTaxExchange,
  validateBookkeepingTaxExchange,
} from './bookkeeping-tax-exchange';

const source = {
  businessId: 'synthetic-business-0001',
  businessName: 'SYNTHETIC EXAMPLE LLC (not a real business)',
  reference: 'synthetic-cash-basis-report:2026-01-01:2026-10-31',
};
const period = { fromDate: '2026-01-01', throughDate: '2026-10-31' };
const report: CashBasisReport = {
  ...period,
  incomeCents: 1_250_000n,
  expenseCents: 1_312_345n,
  netIncomeCents: -62_345n,
};

const clone = (): Record<string, any> => JSON.parse(JSON.stringify(fixture));
const issuesOf = (value: unknown): string[] => {
  const result = validateBookkeepingTaxExchange(value);
  return result.ok ? [] : result.issues;
};

describe('bookkeeping-to-tax exchange v1 contract parity', () => {
  it('accepts the synthetic fixture, which is clearly marked synthetic', () => {
    const result = validateBookkeepingTaxExchange(fixture);
    expect(result.ok).toBe(true);
    expect(fixture.source.businessName).toMatch(/SYNTHETIC/);
    expect(fixture.source.businessId).toMatch(/^synthetic-/);
    expect(fixture.source.reference).toMatch(/^synthetic-/);
  });

  it('builds a record from a cash-basis report that equals the fixture', () => {
    const record = buildBookkeepingTaxExchange({ report, expectedPeriod: period, source });
    expect(record).toEqual(fixture);
    expect(JSON.parse(serializeBookkeepingTaxExchange(record))).toEqual(fixture);
  });

  it('matches the JSON schema field sets and constants', () => {
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual([...BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.topLevel].sort());
    expect(Object.keys(schema.properties).sort()).toEqual([...BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.topLevel].sort());
    expect(Object.keys(fixture).sort()).toEqual([...BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.topLevel].sort());
    const nested = [
      [schema.properties.source, BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.source],
      [schema.properties.period, BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.period],
      [schema.properties.totals, BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.totals],
    ] as const;
    for (const [definition, keys] of nested) {
      expect(definition.additionalProperties).toBe(false);
      expect([...definition.required].sort()).toEqual([...keys].sort());
      expect(Object.keys(definition.properties).sort()).toEqual([...keys].sort());
    }
    expect(schema.properties.schemaVersion.const).toBe(1);
    expect(schema.properties.product.const).toBe('LLCBookKeepingPrivate');
    expect(schema.properties.basis.const).toBe('cash');
    expect(schema.properties.currency.const).toBe('USD');
    expect(schema.properties.reviewStatus.const).toBe('unreviewed');
    expect(schema.properties.limitations.const).toEqual([...BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS]);
  });

  it('uses schema patterns consistent with the validator', () => {
    const cents = new RegExp(schema.$defs.cents.pattern);
    for (const ok of ['0', '1', '-1', '9007199254740993', '-123456789012345678901234567890']) {
      expect(cents.test(ok)).toBe(true);
      expect(issuesOf({ ...clone(), totals: { incomeCents: ok, expenseCents: '0', netIncomeCents: ok } })).toEqual([]);
    }
    for (const bad of ['-0', '01', '1.0', '1e3', '+1', ' 1', '', '--1', '1n']) {
      expect(cents.test(bad)).toBe(false);
      expect(issuesOf({ ...clone(), totals: { incomeCents: bad, expenseCents: '0', netIncomeCents: '0' } })).not.toEqual([]);
    }
    const text = new RegExp(schema.$defs.nonEmptyText.pattern);
    for (const ok of ['A', 'Synthetic LLC', 'a b']) expect(text.test(ok)).toBe(true);
    for (const bad of ['', ' a', 'a ', 'a\u0000b', 'a\nb', '\u0007']) {
      expect(text.test(bad)).toBe(false);
      expect(issuesOf({ ...clone(), source: { ...source, businessName: bad } })).not.toEqual([]);
    }
  });
});

describe('lossless serialization', () => {
  it('roundtrips amounts beyond Number.MAX_SAFE_INTEGER without coercion', () => {
    const huge = 9_007_199_254_740_993n; // MAX_SAFE_INTEGER + 2, not representable as a double
    const big: CashBasisReport = {
      ...period,
      incomeCents: huge * 1_000n + 7n,
      expenseCents: huge,
      netIncomeCents: -(huge * 3n + 1n),
    };
    const record = buildBookkeepingTaxExchange({ report: big, expectedPeriod: period, source });
    const json = serializeBookkeepingTaxExchange(record);
    expect(json).toContain('"incomeCents": "9007199254740993007"');
    expect(json).toContain('"netIncomeCents": "-27021597764222980"');
    const parsed = parseBookkeepingTaxExchange(json);
    expect(parsed).toEqual(record);
    expect(bookkeepingTaxExchangeTotals(parsed)).toEqual({
      incomeCents: big.incomeCents,
      expenseCents: big.expenseCents,
      netIncomeCents: big.netIncomeCents,
    });
    expect(serializeBookkeepingTaxExchange(parsed)).toBe(json);
  });

  it('copies report totals exactly, including negative and inconsistent values, without recomputing', () => {
    const odd: CashBasisReport = { ...period, incomeCents: -5n, expenseCents: 0n, netIncomeCents: 123n };
    const record = buildBookkeepingTaxExchange({ report: odd, expectedPeriod: period, source });
    expect(record.totals).toEqual({ incomeCents: '-5', expenseCents: '0', netIncomeCents: '123' });
  });

  it('produces deterministic output with a trailing newline and fixed key order', () => {
    const json = serializeBookkeepingTaxExchange(buildBookkeepingTaxExchange({ report, expectedPeriod: period, source }));
    expect(json.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(json))).toEqual([...BOOKKEEPING_TAX_EXCHANGE_FIELD_KEYS.topLevel]);
    const reordered = { ...clone() };
    const shuffled = Object.fromEntries(Object.entries(reordered).reverse());
    expect(serializeBookkeepingTaxExchange(shuffled as BookkeepingTaxExchangeV1)).toBe(json);
  });

  it('converts cents helpers without floating point and rejects non-bigint input', () => {
    expect(exchangeCentsToBigInt('-9007199254740993')).toBe(-9_007_199_254_740_993n);
    expect(bigIntToExchangeCents(-0n)).toBe('0');
    expect(() => exchangeCentsToBigInt('1.5')).toThrow(BookkeepingTaxExchangeError);
    expect(() => bigIntToExchangeCents(5 as unknown as bigint)).toThrow(BookkeepingTaxExchangeError);
  });
});

describe('building from a cash-basis report fails closed', () => {
  it('rejects a report whose period does not match the requested period', () => {
    expect(() => buildBookkeepingTaxExchange({
      report, expectedPeriod: { fromDate: '2026-01-01', throughDate: '2026-10-30' }, source,
    })).toThrow(/does not match the requested period/);
    expect(() => buildBookkeepingTaxExchange({
      report: { ...report, fromDate: '2026-02-01' }, expectedPeriod: period, source,
    })).toThrow(BookkeepingTaxExchangeError);
  });

  it('rejects unsafe or non-bigint report amounts', () => {
    for (const value of [Number.MAX_SAFE_INTEGER + 2, 12.5, '100', null, undefined, Number.NaN]) {
      expect(() => buildBookkeepingTaxExchange({
        report: { ...report, incomeCents: value as unknown as bigint }, expectedPeriod: period, source,
      })).toThrow(/report.incomeCents must be bigint cents/);
    }
  });

  it('rejects invalid report periods and missing source details', () => {
    const reversed = { fromDate: '2026-10-31', throughDate: '2026-01-01' };
    expect(() => buildBookkeepingTaxExchange({ report: { ...report, ...reversed }, expectedPeriod: reversed, source }))
      .toThrow(/on or before/);
    const leap = { fromDate: '2026-02-29', throughDate: '2026-03-31' };
    expect(() => buildBookkeepingTaxExchange({ report: { ...report, ...leap }, expectedPeriod: leap, source }))
      .toThrow(/real calendar date/);
    expect(() => buildBookkeepingTaxExchange({ report, expectedPeriod: period, source: { ...source, reference: '' } }))
      .toThrow(/source.reference/);
    expect(() => buildBookkeepingTaxExchange({
      report, expectedPeriod: period, source: undefined as unknown as typeof source,
    })).toThrow(/source must be an object/);
  });
});

describe('validation of untrusted records fails closed', () => {
  it('rejects unknown or missing schema versions', () => {
    for (const version of [0, 2, '1', 1.5, null]) {
      expect(issuesOf({ ...clone(), schemaVersion: version })).toEqual([
        'schemaVersion is not supported; only version 1 is accepted',
      ]);
    }
    const { schemaVersion: _omit, ...missing } = clone();
    expect(issuesOf(missing)).toContain('schemaVersion is required');
  });

  it('rejects non-object input and invalid JSON', () => {
    for (const value of [null, [], 'x', 1, undefined]) expect(issuesOf(value)).toEqual(['record must be a JSON object']);
    expect(() => parseBookkeepingTaxExchange('{')).toThrow(/not valid JSON/);
    expect(() => parseBookkeepingTaxExchange('[]')).toThrow(BookkeepingTaxExchangeError);
  });

  it('rejects malformed, impossible and leap-day dates', () => {
    for (const bad of ['2026-1-01', '2026/01/01', '2026-13-01', '2026-00-10', '2026-04-31', '2026-02-29', '2100-02-29', '', 20260101]) {
      expect(issuesOf({ ...clone(), period: { fromDate: bad, throughDate: '2026-10-31' } }))
        .toContain('period.fromDate must be a real calendar date in YYYY-MM-DD format');
    }
    expect(issuesOf({ ...clone(), period: { fromDate: '2024-02-29', throughDate: '2024-02-29' } })).toEqual([]);
    expect(issuesOf({ ...clone(), period: { fromDate: '2000-02-29', throughDate: '2000-12-31' } })).toEqual([]);
  });

  it('rejects a reversed period and accepts a single-day period', () => {
    expect(issuesOf({ ...clone(), period: { fromDate: '2026-10-31', throughDate: '2026-10-30' } }))
      .toEqual(['period.fromDate must be on or before period.throughDate']);
    expect(issuesOf({ ...clone(), period: { fromDate: '2026-10-31', throughDate: '2026-10-31' } })).toEqual([]);
  });

  it('rejects unsupported currency, basis, product and review status', () => {
    for (const currency of ['usd', 'EUR', '', null]) expect(issuesOf({ ...clone(), currency })).toEqual(['currency must be USD']);
    expect(issuesOf({ ...clone(), basis: 'accrual' })).toEqual(['basis must be cash']);
    expect(issuesOf({ ...clone(), product: 'LLCBookKeepingTaxReturn' })).toEqual(['product must be LLCBookKeepingPrivate']);
    for (const reviewStatus of ['reviewed', 'approved', '', null]) {
      expect(issuesOf({ ...clone(), reviewStatus })).toEqual(['reviewStatus must be unreviewed']);
    }
    const { reviewStatus: _omit, ...missing } = clone();
    expect(issuesOf(missing)).toEqual(['reviewStatus is required']);
  });

  it('rejects numeric, unsafe and nonintegral cents', () => {
    for (const bad of [100, 9007199254740993, 1.5, -0, null, true, {}, '12.34', '1,000']) {
      expect(issuesOf({ ...clone(), totals: { ...clone().totals, expenseCents: bad } }))
        .toEqual(['totals.expenseCents must be a decimal integer string of cents']);
    }
    expect(() => parseBookkeepingTaxExchange(JSON.stringify(clone()).replace('"1250000"', '9007199254740993')))
      .toThrow(/totals.incomeCents/);
  });

  it('rejects missing or invalid source details', () => {
    const { source: _omit, ...missing } = clone();
    expect(issuesOf(missing)).toEqual(['source is required']);
    expect(issuesOf({ ...clone(), source: 'synthetic' })).toEqual(['source must be an object']);
    const { reference: _ref, ...noReference } = source;
    expect(issuesOf({ ...clone(), source: noReference })).toEqual(['source.reference is required']);
    expect(issuesOf({ ...clone(), source: { ...source, businessId: 'x'.repeat(201) } })).toHaveLength(1);
    expect(issuesOf({ ...clone(), source: { ...source, businessId: 'x'.repeat(200) } })).toEqual([]);
  });

  it('rejects extra unknown fields at every level instead of dropping them', () => {
    expect(issuesOf({ ...clone(), taxClassification: 'partnership' })).toEqual(['taxClassification is not a supported field']);
    expect(issuesOf({ ...clone(), source: { ...source, ein: 'synthetic' } })).toEqual(['source.ein is not a supported field']);
    expect(issuesOf({ ...clone(), period: { ...period, timezone: 'UTC' } })).toEqual(['period.timezone is not a supported field']);
    expect(issuesOf({ ...clone(), totals: { ...clone().totals, deductibleCents: '1' } }))
      .toEqual(['totals.deductibleCents is not a supported field']);
    expect(() => parseBookkeepingTaxExchange(JSON.stringify(clone()).replace('{', '{"__proto__":{"x":1},')))
      .toThrow(/__proto__ is not a supported field/);
  });

  it('rejects altered, reordered or missing limitations', () => {
    const limitations = [...BOOKKEEPING_TAX_EXCHANGE_LIMITATIONS];
    for (const bad of [[], limitations.slice(1), [...limitations].reverse(), [...limitations, 'extra'], 'Book figures only']) {
      expect(issuesOf({ ...clone(), limitations: bad })).toEqual(['limitations must equal the fixed v1 limitation statements']);
    }
  });

  it('serialize refuses an invalid record', () => {
    expect(() => serializeBookkeepingTaxExchange({ ...clone(), currency: 'EUR' } as BookkeepingTaxExchangeV1))
      .toThrow(/currency must be USD/);
  });
});
