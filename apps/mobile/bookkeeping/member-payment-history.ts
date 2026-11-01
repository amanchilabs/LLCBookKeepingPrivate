export type MemberPaymentHistoryEvent = {
  paymentId: string;
  kind: 'payment' | 'reversal';
};

export function canCreateGuaranteedPayment(memberCount: number): boolean {
  return memberCount > 1;
}

export function shouldShowPaymentHistoryControls(
  memberCount: number,
  events: readonly MemberPaymentHistoryEvent[],
): boolean {
  if (memberCount > 1) return true;
  const reversedPaymentIds = new Set(events
    .filter((event) => event.kind === 'reversal')
    .map((event) => event.paymentId));
  return events.some((event) => event.kind === 'payment' && !reversedPaymentIds.has(event.paymentId));
}

export function canReverseHistoricalPayment(kind: MemberPaymentHistoryEvent['kind'], isReversed: boolean): boolean {
  return kind === 'payment' && !isReversed;
}
