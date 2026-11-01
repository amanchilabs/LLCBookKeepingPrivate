import type { CashBasisReport, GeneralLedgerReport, JournalBalanceReport } from '../../../packages/storage-native/src/bookkeeping-store';

const csv = (rows: string[][]): string => rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
const escapeCsv = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const usd = (cents: bigint): string => {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
};

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
