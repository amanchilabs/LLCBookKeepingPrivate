import { describe, expect, it } from 'vitest';
import { transactionWorkspaceSections } from './transaction-workspace';

describe('transaction workspace navigation', () => {
  it('keeps history, recurring transactions, and CSV import as distinct sections', () => {
    expect(transactionWorkspaceSections).toEqual([
      { value: 'history', title: 'History' },
      { value: 'recurring', title: 'Recurring' },
      { value: 'import', title: 'Import CSV' },
    ]);
  });
});
