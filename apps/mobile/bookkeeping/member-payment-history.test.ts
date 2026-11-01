import { describe, expect, it } from 'vitest';
import { canCreateGuaranteedPayment, canReverseHistoricalPayment, shouldShowPaymentHistoryControls } from './member-payment-history';

describe('member payment history controls', () => {
  it('keeps new guaranteed-payment obligations disabled for a sole member even when old payments need correction', () => {
    expect(canCreateGuaranteedPayment(1)).toBe(false);
    expect(canCreateGuaranteedPayment(2)).toBe(true);
  });

  it('keeps return-cash controls available for an unreversed payment after the LLC becomes single-member', () => {
    const events = [
      { paymentId: 'payment-1', kind: 'payment' as const },
    ];

    expect(shouldShowPaymentHistoryControls(1, events)).toBe(true);
    expect(canReverseHistoricalPayment('payment', false)).toBe(true);
  });

  it('hides single-member correction controls when all historical payments are already reversed', () => {
    const events = [
      { paymentId: 'payment-1', kind: 'payment' as const },
      { paymentId: 'payment-1', kind: 'reversal' as const },
    ];

    expect(shouldShowPaymentHistoryControls(1, events)).toBe(false);
    expect(canReverseHistoricalPayment('payment', true)).toBe(false);
  });

  it('keeps payment history controls available for multi-member LLCs', () => {
    expect(shouldShowPaymentHistoryControls(4, [])).toBe(true);
  });
});
