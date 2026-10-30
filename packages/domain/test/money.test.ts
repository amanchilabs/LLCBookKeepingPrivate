import { describe, expect, it } from 'vitest';
import { parseUsd, sumUsd } from '../src/money';

describe('fixed precision USD', () => {
  it('parses decimal text exactly into cents', () => {
    expect(parseUsd('0.10')).toBe(10n);
    expect(parseUsd('42,000.00')).toBe(4_200_000n);
  });

  it('rejects floating-point-like precision and malformed amounts', () => {
    expect(() => parseUsd('0.001')).toThrow();
    expect(() => parseUsd('-1.00')).toThrow();
    expect(() => parseUsd('1e3')).toThrow();
  });

  it('sums minor units without binary floating point', () => {
    expect(sumUsd([10n, 20n, 5n])).toBe(35n);
  });
});
