import { describe, expect, it } from 'vitest';
import {
  assertOwnershipTotals,
  assertValidBusinessSetup,
  cashExpenseLines,
  cashIncomeLines,
  openingBalanceLines,
  reverseLines,
  type BusinessSetupInput,
} from '../src/bookkeeping';
import { assertBalancedEntry } from '../src/journal';

const fourMemberSetup: BusinessSetupInput = {
  id: 'business-1',
  name: 'Northstar Studio LLC',
  formationState: 'AZ',
  formationDate: '2024-03-01',
  bookkeepingStartDate: '2024-01-01',
  ownershipConfirmed: true,
  members: [
    { id: 'member-1', name: 'Jordan Lee', ownershipBasisPoints: 4_000 },
    { id: 'member-2', name: 'Casey Morgan', ownershipBasisPoints: 2_000 },
    { id: 'member-3', name: 'Riley Patel', ownershipBasisPoints: 2_000 },
    { id: 'member-4', name: 'Avery Kim', ownershipBasisPoints: 2_000 },
  ],
};

describe('bookkeeping setup and cash posting rules', () => {
  it('accepts the suggested four-member ownership split only when explicitly confirmed', () => {
    expect(assertValidBusinessSetup(fourMemberSetup)).toBeUndefined();
    expect(assertOwnershipTotals(fourMemberSetup.members)).toBeUndefined();
    expect(() => assertValidBusinessSetup({ ...fourMemberSetup, ownershipConfirmed: false }))
      .toThrow('Confirm the ownership interests');
  });

  it('requires valid state and calendar dates without assuming formation precedes book start', () => {
    expect(() => assertValidBusinessSetup({ ...fourMemberSetup, formationState: 'XX' })).toThrow('formation state');
    expect(() => assertValidBusinessSetup({ ...fourMemberSetup, formationDate: '2024-02-30' })).toThrow('valid date');
    expect(() => assertValidBusinessSetup({ ...fourMemberSetup, bookkeepingStartDate: '2024-13-01' })).toThrow('valid date');
    expect(assertValidBusinessSetup(fourMemberSetup)).toBeUndefined();
  });

  it('requires ownership percentages to total exactly 100 percent and unique named members', () => {
    expect(() => assertOwnershipTotals(fourMemberSetup.members.map((member, index) => ({
      ...member,
      ownershipBasisPoints: index === 0 ? 3_900 : member.ownershipBasisPoints,
    })))).toThrow('total 100%');
    expect(() => assertOwnershipTotals([...fourMemberSetup.members, fourMemberSetup.members[0]])).toThrow('unique');
    expect(() => assertOwnershipTotals(fourMemberSetup.members.map((member, index) => ({
      ...member,
      name: index === 0 ? '  ' : member.name,
    })))).toThrow('name');
  });

  it('posts positive and negative opening balances against opening balance equity', () => {
    const positive = openingBalanceLines('bank-1', 'equity-opening', 125_050n);
    expect(positive).toEqual([
      { account: 'bank-1', debitCents: 125_050n, creditCents: 0n },
      { account: 'equity-opening', debitCents: 0n, creditCents: 125_050n },
    ]);
    const negative = openingBalanceLines('bank-1', 'equity-opening', -500n);
    expect(negative).toEqual([
      { account: 'equity-opening', debitCents: 500n, creditCents: 0n },
      { account: 'bank-1', debitCents: 0n, creditCents: 500n },
    ]);
    expect(() => openingBalanceLines('bank-1', 'equity-opening', 0n)).toThrow('non-zero');
    assertBalancedEntry(positive);
    assertBalancedEntry(negative);
  });

  it('posts cash income and expenses with the correct normal-side journal lines', () => {
    const income = cashIncomeLines('bank-1', 'income-services', 12_500n);
    const expense = cashExpenseLines('bank-1', 'expense-supplies', 3_250n);
    expect(income).toEqual([
      { account: 'bank-1', debitCents: 12_500n, creditCents: 0n },
      { account: 'income-services', debitCents: 0n, creditCents: 12_500n },
    ]);
    expect(expense).toEqual([
      { account: 'expense-supplies', debitCents: 3_250n, creditCents: 0n },
      { account: 'bank-1', debitCents: 0n, creditCents: 3_250n },
    ]);
    assertBalancedEntry(income);
    assertBalancedEntry(expense);
    expect(() => cashIncomeLines('bank-1', 'income-services', 0n)).toThrow('positive');
  });

  it('reverses every journal line without modifying the original entry', () => {
    const original = cashExpenseLines('bank-1', 'expense-supplies', 3_250n);
    const reversal = reverseLines(original);
    expect(reversal).toEqual([
      { account: 'expense-supplies', debitCents: 0n, creditCents: 3_250n },
      { account: 'bank-1', debitCents: 3_250n, creditCents: 0n },
    ]);
    expect(original[0].debitCents).toBe(3_250n);
    assertBalancedEntry(reversal);
  });
});
