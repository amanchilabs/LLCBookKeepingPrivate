import type {
  CashBasisReport,
  GeneralLedgerReport,
  GuaranteedPaymentCashEvent,
  JournalBalanceReport,
  LoanActivityRecord,
  LoanAgreementRecord,
  MemberCapitalActivityRecord,
} from '../../../packages/storage-native/src/bookkeeping-store';

const csv = (rows: string[][]): string => rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
const escapeCsv = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const usd = (cents: bigint): string => {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
};

export function isValidDateRange(fromDate: string, throughDate: string): boolean {
  return isValidDate(fromDate) && isValidDate(throughDate) && fromDate <= throughDate;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function cashBasisCsv(report: CashBasisReport): string {
  return csv([
    ['From date', 'Through date', 'Basis', 'Line item', 'Amount'],
    [report.fromDate, report.throughDate, 'Cash basis', 'Income', usd(report.incomeCents)],
    [report.fromDate, report.throughDate, 'Cash basis', 'Operating expenses', usd(report.expenseCents)],
    [report.fromDate, report.throughDate, 'Cash basis', 'Net income', usd(report.netIncomeCents)],
  ]);
}

export function balanceSheetCsv(report: JournalBalanceReport): string {
  const date = report.asOfDate;
  const { balanceSheet } = report;
  return csv([
    ['As of date', 'Section', 'Line item', 'Account', 'Balance'],
    ...balanceSheet.assets.map((line) => [date, 'Assets', line.name, '', usd(line.balanceCents)]),
    [date, 'Assets', 'Total assets', '', usd(balanceSheet.totalAssetsCents)],
    ...balanceSheet.liabilities.map((line) => [date, 'Liabilities', line.name, '', usd(line.balanceCents)]),
    [date, 'Liabilities', 'Total liabilities', '', usd(balanceSheet.totalLiabilitiesCents)],
    ...balanceSheet.equity.map((line) => [date, 'Equity', line.name, '', usd(line.balanceCents)]),
    [date, 'Equity', 'Current earnings through date', '', usd(balanceSheet.currentEarningsCents)],
    [date, 'Equity', 'Total equity', '', usd(balanceSheet.totalEquityCents)],
    [date, 'Reconciliation', 'Assets − liabilities − equity', '', usd(balanceSheet.differenceCents)],
  ]);
}

export function trialBalanceCsv(report: JournalBalanceReport): string {
  const rows = report.trialBalance.map((line) => [
    report.asOfDate, line.name, line.kind, usd(line.debitCents), usd(line.creditCents),
  ]);
  rows.push([report.asOfDate, 'TOTALS', '', usd(report.totalDebitsCents), usd(report.totalCreditsCents)]);
  return csv([['As of date', 'Account', 'Account type', 'Debit', 'Credit'], ...rows]);
}

export function generalLedgerCsv(report: GeneralLedgerReport): string {
  const rows = report.lines.map((line) => [
    report.asOfDate, report.accountName, line.date, line.journalEntryId, line.description,
    usd(line.debitCents), usd(line.creditCents), usd(line.runningBalanceCents),
  ]);
  rows.push([
    report.asOfDate, report.accountName, 'TOTALS', '', '',
    usd(report.totalDebitsCents), usd(report.totalCreditsCents), usd(report.endingBalanceCents),
  ]);
  return csv([['As of date', 'Account', 'Date', 'Journal entry', 'Description', 'Debit', 'Credit', 'Running balance'], ...rows]);
}

export function memberCapitalMovementCsv(
  fromDate: string,
  throughDate: string,
  activities: readonly MemberCapitalActivityRecord[],
): string {
  const selected = activities.filter((activity) => activity.date >= fromDate && activity.date <= throughDate);
  let capitalMovementCents = 0n;
  let cashMovementCents = 0n;
  const rows = selected.map((activity) => {
    const isDistribution = activity.kind === 'distribution';
    const capitalCents = isDistribution ? -activity.amountCents : activity.amountCents;
    const cashCents = activity.kind === 'cash-contribution'
      ? activity.amountCents
      : isDistribution ? -activity.amountCents : 0n;
    capitalMovementCents += capitalCents;
    cashMovementCents += cashCents;
    const activityName = activity.kind === 'cash-contribution'
      ? 'Cash contribution'
      : activity.kind === 'property-contribution' ? 'Property contribution' : 'Distribution';
    return [
      fromDate, throughDate, activity.date, activity.journalEntryId, activity.memberName, activityName,
      usd(capitalCents), usd(cashCents), activity.cashAccountName ?? '', activity.propertyDescription ?? '',
      activity.description, activity.requiresCpaReview ? 'Yes' : 'No',
    ];
  });
  rows.push([
    fromDate, throughDate, throughDate, '', 'TOTAL', 'Selected-period totals',
    usd(capitalMovementCents), usd(cashMovementCents), '', '', '', '',
  ]);
  return csv([[
    'From date', 'Through date', 'Date', 'Journal entry', 'Member', 'Activity',
    'Book capital movement', 'Cash movement', 'Cash account', 'Property description', 'Description', 'CPA review',
  ], ...rows]);
}

export function guaranteedPaymentCashCsv(
  fromDate: string,
  throughDate: string,
  events: readonly GuaranteedPaymentCashEvent[],
): string {
  if (!isValidDateRange(fromDate, throughDate)) {
    throw new Error('Enter a valid date range before exporting guaranteed-payment cash activity.');
  }

  const selected = events
    .filter((event) => event.date >= fromDate && event.date <= throughDate)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date)
      || (left.kind === right.kind ? 0 : left.kind === 'payment' ? -1 : 1)
      || left.id.localeCompare(right.id));
  const servicesNetCents = selected
    .filter((event) => event.classification === 'services')
    .reduce((sum, event) => sum + event.amountCents, 0n);
  const capitalUseNetCents = selected
    .filter((event) => event.classification === 'use-of-capital')
    .reduce((sum, event) => sum + event.amountCents, 0n);

  const rows = selected.map((event) => [
    fromDate, throughDate, event.date, event.kind === 'payment' ? 'Payment' : 'Reversal',
    event.memberName, event.classification === 'services' ? 'Services' : 'Use of capital',
    usd(event.amountCents), usd(-event.amountCents), event.cashAccountName, event.description, event.paymentId,
    event.transactionId, event.reason ?? '',
  ]);
  const totalRow = (classification: string, amountCents: bigint): string[] => [
    fromDate, throughDate, throughDate, 'Period total', '', classification,
    usd(amountCents), usd(-amountCents), '', '', '', '', '',
  ];
  rows.push(
    totalRow('Services net', servicesNetCents),
    totalRow('Use of capital net', capitalUseNetCents),
    totalRow('All cash activity net', servicesNetCents + capitalUseNetCents),
  );
  return csv([[
    'From date', 'Through date', 'Date', 'Event', 'Member', 'Classification',
    'Signed workpaper amount (+ paid / - returned)', 'Cash movement (- paid / + returned)',
    'Cash account', 'Description', 'Payment ID', 'Transaction ID', 'Reversal reason',
  ], ...rows]);
}

export function loanCashActivityCsv(
  fromDate: string,
  throughDate: string,
  activities: readonly LoanActivityRecord[],
  agreements: readonly LoanAgreementRecord[],
): string {
  if (!isValidDateRange(fromDate, throughDate)) {
    throw new Error('Enter a valid date range before exporting loan cash activity.');
  }

  const agreementsById = new Map(agreements.map((agreement) => [agreement.id, agreement]));
  const selected = activities
    .filter((activity) => activity.date >= fromDate && activity.date <= throughDate)
    .slice()
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  let cashMovementCents = 0n;
  let principalMovementCents = 0n;
  let interestPaidCents = 0n;
  const rows = selected.map((activity) => {
    const agreement = agreementsById.get(activity.loanId);
    if (!agreement) throw new Error('Loan activity references an unknown agreement.');
    const principalCents = activity.kind === 'advance' ? activity.amountCents : -activity.principalCents;
    const interestCents = activity.kind === 'repayment' ? activity.interestCents : 0n;
    cashMovementCents += activity.amountCents;
    principalMovementCents += principalCents;
    interestPaidCents += interestCents;
    return [
      fromDate, throughDate, activity.date, activity.kind === 'advance' ? 'Advance' : 'Repayment',
      agreement.lenderName, agreement.lenderType === 'member' ? 'Member' : 'Third party', agreement.id,
      activity.cashAccountName, usd(activity.amountCents), usd(principalCents), usd(interestCents),
      activity.description, activity.id, activity.transactionId, activity.journalEntryId,
    ];
  });
  rows.push([
    fromDate, throughDate, throughDate, 'Period totals', '', '', '', '',
    usd(cashMovementCents), usd(principalMovementCents), usd(interestPaidCents), '', '', '', '',
  ]);
  return csv([[
    'From date', 'Through date', 'Date', 'Event', 'Lender', 'Lender type', 'Loan ID', 'Cash account',
    'Cash movement (+ advance / - repayment)', 'Principal movement (+ advance / - repayment)',
    'Interest paid', 'Description', 'Activity ID', 'Transaction ID', 'Journal entry ID',
  ], ...rows]);
}
