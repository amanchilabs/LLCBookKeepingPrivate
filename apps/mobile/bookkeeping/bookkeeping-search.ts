import { formatUsd } from '../../../packages/domain/src/money';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';

export type BookkeepingSearchDestination = 'Transactions' | 'Accounts' | 'Members' | 'Loans' | 'Settings';
export type BookkeepingSearchKind =
  | 'business' | 'member' | 'account' | 'transaction' | 'capital'
  | 'guaranteed-payment' | 'loan' | 'loan-activity' | 'recurring'
  | 'reconciliation' | 'period' | 'reminder';

export interface BookkeepingSearchResult {
  id: string;
  kind: BookkeepingSearchKind;
  title: string;
  details: string;
  date: string | null;
  destination: BookkeepingSearchDestination;
}

export function searchBookkeepingRecords(snapshot: BookkeepingSnapshot, rawQuery: string): BookkeepingSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const results: BookkeepingSearchResult[] = [];
  const add = (
    result: BookkeepingSearchResult,
    searchableValues: readonly (string | number | null | undefined)[],
  ) => {
    if ([...searchableValues, result.title, result.details, result.date]
      .some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(query))) {
      results.push(result);
    }
  };

  if (snapshot.business) {
    add({
      id: snapshot.business.id,
      kind: 'business',
      title: snapshot.business.name,
      details: `Formed in ${snapshot.business.formationState} · books begin ${snapshot.business.bookkeepingStartDate}`,
      date: snapshot.business.formationDate,
      destination: 'Settings',
    }, [snapshot.business.name, snapshot.business.formationState, snapshot.business.formationDate, snapshot.business.bookkeepingStartDate]);
  }

  for (const member of snapshot.memberHistory) {
    add({
      id: `${member.id}:${member.effectiveFrom}`,
      kind: 'member',
      title: member.name,
      details: `Ownership ${formatOwnershipPercent(member.ownershipBasisPoints)}% · effective ${member.effectiveFrom}${member.effectiveTo ? ` through ${member.effectiveTo}` : ' onward'}`,
      date: member.effectiveFrom,
      destination: 'Members',
    }, [member.name, member.ownershipBasisPoints, member.effectiveFrom, member.effectiveTo]);
  }

  for (const account of snapshot.accounts) {
    add({
      id: account.id,
      kind: 'account',
      title: account.name,
      details: `${account.kind} · ${account.category} · balance ${formatUsd(account.balanceCents)}`,
      date: null,
      destination: 'Accounts',
    }, [account.name, account.code, account.kind, account.category, formatUsd(account.balanceCents)]);
  }

  for (const transaction of snapshot.transactions) {
    const splitCategories = transaction.splitLines?.map((line) => line.category) ?? [];
    add({
      id: transaction.id,
      kind: 'transaction',
      title: transaction.description || transaction.category,
      details: `${transaction.date} · ${transaction.kind} · ${transaction.accountName} · ${transaction.category} · ${formatUsd(transaction.amountCents)}`,
      date: transaction.date,
      destination: 'Transactions',
    }, [transaction.description, transaction.date, transaction.kind, transaction.accountName,
      transaction.category, ...splitCategories, formatUsd(transaction.amountCents)]);
  }

  for (const activity of snapshot.capitalActivities) {
    const label = capitalActivityLabel(activity.kind);
    add({
      id: activity.id,
      kind: 'capital',
      title: activity.description || `${activity.memberName} · ${label}`,
      details: `${activity.date} · ${activity.memberName} · ${label} · ${formatUsd(activity.amountCents)}${activity.cashAccountName ? ` · ${activity.cashAccountName}` : ''}`,
      date: activity.date,
      destination: 'Members',
    }, [activity.memberName, activity.date, activity.kind, label, activity.description,
      activity.cashAccountName, activity.propertyDescription, formatUsd(activity.amountCents)]);
  }

  for (const installment of snapshot.guaranteedPaymentInstallments) {
    const classification = paymentClassificationLabel(installment.classification);
    add({
      id: installment.id,
      kind: 'guaranteed-payment',
      title: `${installment.memberName} · ${classification}`,
      details: `${installment.dueDate} · ${installment.description} · due ${formatUsd(installment.outstandingAmountCents)}`,
      date: installment.dueDate,
      destination: 'Members',
    }, [installment.memberName, classification, installment.description, installment.dueDate,
      formatUsd(installment.scheduledAmountCents), formatUsd(installment.paidAmountCents), formatUsd(installment.outstandingAmountCents)]);
  }

  for (const event of snapshot.guaranteedPaymentCashEvents) {
    const eventName = event.kind === 'payment' ? 'Payment' : 'Payment reversal';
    const classification = paymentClassificationLabel(event.classification);
    add({
      id: event.id,
      kind: 'guaranteed-payment',
      title: `${eventName} · ${event.memberName}`,
      details: `${event.date} · ${classification} · ${event.cashAccountName} · ${event.description} · ${formatUsd(event.amountCents)}`,
      date: event.date,
      destination: 'Members',
    }, [eventName, event.memberName, classification, event.date, event.cashAccountName,
      event.description, event.reason, formatUsd(event.amountCents)]);
  }

  const loansById = new Map(snapshot.loanAgreements.map((loan) => [loan.id, loan]));
  for (const loan of snapshot.loanAgreements) {
    add({
      id: loan.id,
      kind: 'loan',
      title: `${loan.lenderName} · loan agreement`,
      details: `${loan.agreementDate} · ${loan.description} · commitment ${formatUsd(loan.commitmentCents)} · ${formatRate(loan.annualRateBasisPoints)}% · ${loan.dayCount}`,
      date: loan.agreementDate,
      destination: 'Loans',
    }, [loan.lenderName, loan.lenderType, loan.agreementDate, loan.description, loan.dayCount,
      formatUsd(loan.commitmentCents), formatRate(loan.annualRateBasisPoints)]);
  }

  for (const activity of snapshot.loanActivities) {
    const loan = loansById.get(activity.loanId);
    add({
      id: activity.id,
      kind: 'loan-activity',
      title: `${activity.kind === 'advance' ? 'Advance' : 'Repayment'} · ${activity.description}`,
      details: `${activity.date} · ${loan?.lenderName ?? 'Loan'} · ${activity.cashAccountName} · ${formatUsd(activity.amountCents)} · principal ${formatUsd(activity.principalCents)} · interest ${formatUsd(activity.interestCents)}`,
      date: activity.date,
      destination: 'Loans',
    }, [activity.kind, activity.date, activity.description, activity.cashAccountName,
      loan?.lenderName, loan?.description, formatUsd(activity.amountCents),
      formatUsd(activity.principalCents), formatUsd(activity.interestCents)]);
  }

  for (const schedule of snapshot.recurringTransactions) {
    add({
      id: schedule.id,
      kind: 'recurring',
      title: schedule.description,
      details: `${schedule.kind} · ${schedule.category} · ${schedule.cadence} · next ${schedule.nextDate}${schedule.isActive ? '' : ' · inactive'}`,
      date: schedule.nextDate,
      destination: 'Transactions',
    }, [schedule.description, schedule.kind, schedule.category, schedule.cadence, schedule.nextDate,
      schedule.accountName, formatUsd(schedule.amountCents), schedule.isActive ? 'active' : 'inactive']);
  }

  for (const reconciliation of snapshot.accountReconciliations) {
    add({
      id: reconciliation.id,
      kind: 'reconciliation',
      title: `${reconciliation.accountName} reconciliation`,
      details: `${reconciliation.periodStartDate} through ${reconciliation.statementDate} · ${reconciliation.status} · difference ${formatUsd(reconciliation.differenceCents)}`,
      date: reconciliation.statementDate,
      destination: 'Accounts',
    }, [reconciliation.accountName, reconciliation.periodStartDate, reconciliation.statementDate,
      reconciliation.status, formatUsd(reconciliation.beginningBalanceCents),
      formatUsd(reconciliation.endingBalanceCents), formatUsd(reconciliation.differenceCents),
      ...reconciliation.activities.flatMap((activity) => [activity.date, activity.description])]);
  }

  const reconciliationsById = new Map(snapshot.accountReconciliations.map((record) => [record.id, record]));
  for (const event of snapshot.accountReconciliationEvents) {
    const reconciliation = reconciliationsById.get(event.reconciliationId);
    const action = reconciliationEventLabel(event.eventType);
    add({
      id: event.id,
      kind: 'reconciliation',
      title: `${action} · ${reconciliation?.accountName ?? 'Bank reconciliation'}`,
      details: `${event.createdAt.slice(0, 10)}${reconciliation ? ` · statement ${reconciliation.statementDate}` : ''}${event.transactionId ? ` · transaction ${event.transactionId}` : ''}`,
      date: event.createdAt.slice(0, 10),
      destination: 'Accounts',
    }, [event.eventType, action, event.transactionId, event.createdAt,
      reconciliation?.accountName, reconciliation?.statementDate]);
  }

  for (const event of snapshot.accountingPeriodEvents) {
    add({
      id: event.id,
      kind: 'period',
      title: `${event.action === 'close' ? 'Books closed' : 'Books reopened'} · ${event.throughDate}`,
      details: `${event.periodStartDate} through ${event.throughDate} · ${event.reason}`,
      date: event.createdAt.slice(0, 10),
      destination: 'Settings',
    }, [event.action, event.periodStartDate, event.throughDate, event.reason, event.createdAt]);
  }

  for (const reminder of snapshot.reminders) {
    add({
      id: reminder.id,
      kind: 'reminder',
      title: reminder.title,
      details: `${reminder.dueDate} · ${reminder.isComplete ? 'complete' : 'open'}${reminder.details ? ` · ${reminder.details}` : ''}`,
      date: reminder.dueDate,
      destination: 'Settings',
    }, [reminder.title, reminder.details, reminder.dueDate, reminder.isComplete ? 'complete' : 'open']);
  }

  return results;
}

function capitalActivityLabel(kind: string): string {
  if (kind === 'cash-contribution') return 'Cash contribution';
  if (kind === 'property-contribution') return 'Property contribution';
  return 'Distribution';
}

function paymentClassificationLabel(classification: string): string {
  return classification === 'services' ? 'Services' : 'Use of capital';
}

function formatOwnershipPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}

function formatRate(basisPoints: number): string {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}`;
}

function reconciliationEventLabel(eventType: string): string {
  if (eventType === 'item-cleared') return 'Item cleared';
  if (eventType === 'item-uncleared') return 'Item uncleared';
  if (eventType === 'completed') return 'Reconciliation completed';
  if (eventType === 'reopened') return 'Reconciliation reopened';
  return 'Reconciliation created';
}
