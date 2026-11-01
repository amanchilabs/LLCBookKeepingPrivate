import { describe, expect, it } from 'vitest';
import { findDraftForAccount, selectBankAccountId } from './account-reconciliation-selection';

const bankAccounts = [
  { id: 'bank-a' },
  { id: 'bank-b' },
];

const reconciliations = [
  { accountId: 'bank-a', status: 'draft' as const },
  { accountId: 'bank-b', status: 'draft' as const },
];

describe('account reconciliation selection', () => {
  it('defaults to a draft account and lets the user select a different bank account', () => {
    expect(selectBankAccountId(bankAccounts, reconciliations, '')).toBe('bank-a');
    expect(selectBankAccountId(bankAccounts, reconciliations, 'bank-b')).toBe('bank-b');
  });

  it('shows the draft for the selected account instead of the first draft globally', () => {
    expect(findDraftForAccount(reconciliations, 'bank-b')).toEqual(reconciliations[1]);
    expect(findDraftForAccount(reconciliations, 'missing')).toBeUndefined();
  });
});
