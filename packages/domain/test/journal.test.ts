import { describe, expect, it } from 'vitest';
import {
  assertBalancedEntry,
  accountTransferLines,
  loanAdvanceLines,
  loanRepaymentLines,
  type JournalLine,
} from '../src/journal';

describe('journal posting invariant', () => {
  it('accepts a balanced expense paid from cash', () => {
    const lines: JournalLine[] = [
      { account: 'office-expense', debitCents: 1250n, creditCents: 0n },
      { account: 'cash', debitCents: 0n, creditCents: 1250n },
    ];
    expect(() => assertBalancedEntry(lines)).not.toThrow();
  });

  it('posts a balanced transfer between two cash accounts without income or expense lines', () => {
    expect(accountTransferLines('checking', 'savings', 12_500n)).toEqual([
      { account: 'savings', debitCents: 12_500n, creditCents: 0n },
      { account: 'checking', debitCents: 0n, creditCents: 12_500n },
    ]);
    expect(() => accountTransferLines('checking', 'checking', 12_500n)).toThrow('different');
    expect(() => accountTransferLines('checking', 'savings', 0n)).toThrow('positive');
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

  it('posts a funded loan advance to cash and loan payable, not income', () => {
    expect(loanAdvanceLines('checking', 'loan-payable', 12_500n)).toEqual([
      { account: 'checking', debitCents: 12_500n, creditCents: 0n },
      { account: 'loan-payable', debitCents: 0n, creditCents: 12_500n },
    ]);
  });

  it('separates principal reduction and interest expense within one balanced repayment', () => {
    expect(loanRepaymentLines('checking', 'loan-payable', 'loan-interest', 10_000n, 200n)).toEqual([
      { account: 'loan-payable', debitCents: 10_000n, creditCents: 0n },
      { account: 'loan-interest', debitCents: 200n, creditCents: 0n },
      { account: 'checking', debitCents: 0n, creditCents: 10_200n },
    ]);
    expect(loanRepaymentLines('checking', 'loan-payable', 'loan-interest', 0n, 200n)).toEqual([
      { account: 'loan-interest', debitCents: 200n, creditCents: 0n },
      { account: 'checking', debitCents: 0n, creditCents: 200n },
    ]);
  });

  it('rejects empty or negative loan repayments', () => {
    expect(() => loanRepaymentLines('checking', 'loan-payable', 'loan-interest', 0n, 0n)).toThrow('positive');
    expect(() => loanRepaymentLines('checking', 'loan-payable', 'loan-interest', -1n, 5n)).toThrow('cannot be negative');
  });
});
