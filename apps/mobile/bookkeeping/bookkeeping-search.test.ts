import { describe, expect, it } from 'vitest';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { searchBookkeepingRecords } from './bookkeeping-search';

function emptySnapshot(): BookkeepingSnapshot {
  return {
    business: {
      id: 'business-1', name: 'Northstar Studio LLC', formationState: 'AZ',
      formationDate: '2024-03-01', bookkeepingStartDate: '2024-01-01',
    },
    members: [], memberHistory: [], accounts: [], transactions: [], capitalActivities: [],
    memberCapitalSummaries: [], guaranteedPaymentInstallments: [], guaranteedPaymentCashEvents: [],
    loanAgreements: [], loanActivities: [], accountReconciliations: [], accountReconciliationEvents: [],
    accountingPeriodEvents: [], closedThroughDate: null, recurringTransactions: [], reminders: [],
    cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n },
  };
}

describe('searchBookkeepingRecords', () => {
  it('searches case-insensitively through transaction descriptions and split categories', () => {
    const snapshot = emptySnapshot();
    snapshot.transactions.push({
      id: 'transaction-1', journalEntryId: 'journal-1', date: '2026-03-04', kind: 'expense',
      accountId: 'bank-1', accountName: 'Operating checking', categoryAccountId: 'expense-misc',
      category: 'Split expense', amountCents: -12_500n, description: 'March studio supplies',
      originalTransactionId: null, correctionRole: null, isGuaranteedPayment: false, transferRole: null,
      splitLines: [{ categoryAccountId: 'expense-rent', category: 'Rent', amountCents: 10_000n }],
    });

    expect(searchBookkeepingRecords(snapshot, 'rEnT')).toEqual([
      expect.objectContaining({ kind: 'transaction', title: 'March studio supplies', destination: 'Transactions' }),
    ]);
    expect(searchBookkeepingRecords(snapshot, 'supplies')).toHaveLength(1);
  });

  it('finds member capital, payment, loan, and reminder records with useful destinations', () => {
    const snapshot = emptySnapshot();
    snapshot.memberHistory.push({
      id: 'member-1', name: 'Taylor Kim', ownershipBasisPoints: 4_000,
      effectiveFrom: '2024-01-01', effectiveTo: null, retiredAt: null,
    });
    snapshot.capitalActivities.push({
      id: 'capital-1', journalEntryId: 'capital-entry-1', memberId: 'member-1', memberName: 'Taylor Kim',
      date: '2026-01-03', kind: 'cash-contribution', amountCents: 5_000n, description: 'Taylor initial capital',
      cashAccountName: 'Operating checking', propertyDescription: null, requiresCpaReview: false,
    });
    snapshot.guaranteedPaymentCashEvents.push({
      id: 'payment-event-1', paymentId: 'payment-1', transactionId: 'transaction-2', memberId: 'member-1',
      memberName: 'Taylor Kim', classification: 'services', date: '2026-02-04', kind: 'payment',
      amountCents: 2_500n, cashAccountName: 'Operating checking', description: 'Taylor design services', reason: null,
    });
    snapshot.loanAgreements.push({
      id: 'loan-1', lenderType: 'member', memberId: 'member-1', lenderName: 'Taylor Kim',
      agreementDate: '2026-01-01', commitmentCents: 100_000n, annualRateBasisPoints: 500,
      dayCount: 'ACT/365F', description: 'Taylor equipment loan', liabilityAccountId: 'liability-1',
    });
    snapshot.reminders.push({
      id: 'reminder-1', dueDate: '2026-04-15', title: 'Call Taylor about receipts', details: 'Prepare questions',
      isComplete: false, createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z', completedAt: null,
    });

    const results = searchBookkeepingRecords(snapshot, 'Taylor');
    expect(results.map((result) => result.kind)).toEqual(['member', 'capital', 'guaranteed-payment', 'loan', 'reminder']);
    expect(results.map((result) => result.destination)).toEqual(['Members', 'Members', 'Members', 'Loans', 'Settings']);
  });

  it('searches recurring schedules, reconciliation activity, loan balances, and period history', () => {
    const snapshot = emptySnapshot();
    snapshot.recurringTransactions.push({
      id: 'schedule-1', kind: 'expense', accountId: 'bank-1', accountName: 'Operating checking',
      categoryAccountId: 'expense-rent', category: 'Rent', amountCents: -10_000n,
      description: 'Studio lease', cadence: 'monthly', nextDate: '2026-05-01', isActive: false,
      lastPostedDate: '2026-04-01', lastTransactionId: 'transaction-1',
    });
    snapshot.accountReconciliations.push({
      id: 'reconciliation-1', accountId: 'bank-1', accountName: 'Operating checking',
      periodStartDate: '2026-03-01', statementDate: '2026-04-01', beginningBalanceCents: 50_000n,
      endingBalanceCents: 60_000n, clearedMovementCents: 10_000n, differenceCents: 0n,
      status: 'completed', activities: [{
        transactionId: 'transaction-2', date: '2026-03-15', description: 'Rental deposit', amountCents: 10_000n, cleared: true,
      }],
    });
    snapshot.loanActivities.push({
      id: 'loan-activity-1', loanId: 'loan-1', transactionId: 'loan-transaction-1', journalEntryId: 'loan-entry-1',
      date: '2026-03-20', kind: 'advance', cashAccountId: 'bank-1', cashAccountName: 'Operating checking',
      amountCents: 10_000n, principalCents: 10_000n, interestCents: 0n, description: 'Initial funding',
    });
    snapshot.accountingPeriodEvents.push({
      id: 'period-1', action: 'close', periodStartDate: '2026-01-01', throughDate: '2026-03-31',
      reason: 'Quarter close complete', targetCloseEventId: null, createdAt: '2026-04-02T00:00:00.000Z', isActive: true,
    });

    expect(searchBookkeepingRecords(snapshot, 'inactive')[0]).toMatchObject({ kind: 'recurring', destination: 'Transactions' });
    expect(searchBookkeepingRecords(snapshot, 'rental deposit')[0]).toMatchObject({ kind: 'reconciliation', destination: 'Accounts' });
    expect(searchBookkeepingRecords(snapshot, 'principal')[0]).toMatchObject({ kind: 'loan-activity', destination: 'Loans' });
    expect(searchBookkeepingRecords(snapshot, 'closed')[0]).toMatchObject({ kind: 'period', destination: 'Settings' });
  });

  it('searches manual reconciliation audit events by action and transaction id', () => {
    const snapshot = emptySnapshot();
    snapshot.accountReconciliationEvents.push({
      id: 'reconciliation-event-1', reconciliationId: 'reconciliation-1', eventType: 'item-cleared',
      transactionId: 'transaction-42', createdAt: '2026-04-03T00:00:00.000Z',
    });

    expect(searchBookkeepingRecords(snapshot, 'item-cleared')).toMatchObject([
      expect.objectContaining({ kind: 'reconciliation', title: expect.stringContaining('cleared'), destination: 'Accounts' }),
    ]);
    expect(searchBookkeepingRecords(snapshot, 'transaction-42')).toHaveLength(1);
  });

  it('returns no records for blank queries and never searches another LLC snapshot', () => {
    const snapshot = emptySnapshot();
    expect(searchBookkeepingRecords(snapshot, '  ')).toEqual([]);
    expect(searchBookkeepingRecords(snapshot, 'Cedar')).toEqual([]);
  });
});
