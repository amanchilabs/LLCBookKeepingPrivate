import { describe, expect, it } from 'vitest';
import { transactionRoleLabel } from './transaction-role';

describe('transactionRoleLabel', () => {
  it('keeps correction history visible on a recurring transaction', () => {
    expect(transactionRoleLabel({
      id: 'transaction-1', kind: 'expense', recurringTemplateId: 'schedule-1', correctionRole: null,
      originalTransactionId: 'transaction-1', isGuaranteedPayment: false, transferRole: null,
    })).toBe('Original · corrected');
  });

  it('labels an uncorrected scheduled occurrence as recurring', () => {
    expect(transactionRoleLabel({
      id: 'transaction-2', kind: 'expense', recurringTemplateId: 'schedule-1', correctionRole: null,
      originalTransactionId: null, isGuaranteedPayment: false, transferRole: null,
    })).toBe('Recurring');
  });
});
