import { describe, expect, it } from 'vitest';
import { assertBalancedEntry, type JournalLine } from '../src/journal';

describe('journal posting invariant', () => {
  it('accepts a balanced expense paid from cash', () => {
    const lines: JournalLine[] = [
      { account: 'office-expense', debitCents: 1250n, creditCents: 0n },
      { account: 'cash', debitCents: 0n, creditCents: 1250n },
    ];
    expect(() => assertBalancedEntry(lines)).not.toThrow();
  });

  it('rejects unbalanced or negative lines', () => {
    expect(() => assertBalancedEntry([
      { account: 'expense', debitCents: 100n, creditCents: 0n },
      { account: 'cash', debitCents: 0n, creditCents: 99n },
    ])).toThrow();
    expect(() => assertBalancedEntry([
      { account: 'cash', debitCents: -1n, creditCents: 0n },
      { account: 'equity', debitCents: 0n, creditCents: 1n },
    ])).toThrow();
  });
});
