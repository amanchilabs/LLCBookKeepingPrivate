import React, { useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { StyleSheet, Text, View } from 'react-native';
import { getCashBasisReport, getCashMovementReport, getGeneralLedgerReport, getJournalBalanceReport } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, CashBasisReport, CashMovementReport, GeneralLedgerReport, JournalBalanceReport } from '../../../packages/storage-native/src/bookkeeping-store';
import { summarizeLoanBalance } from '../../../packages/domain/src/loan-interest';
import { balanceSheetCsv, cashBasisCsv, cashMovementCsv, generalLedgerCsv, guaranteedPaymentCashCsv, isValidDateRange, loanCashActivityCsv, memberCapitalMovementCsv, trialBalanceCsv } from './report-exports';
import { buildReportPdfHtml, REPORT_PDF_PAGE_SIZE } from './report-pdf';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

type ReportSection = 'profit-loss' | 'cash-movement' | 'balance-sheet' | 'trial-balance' | 'general-ledger' | 'capital' | 'payments' | 'loans';

export function ReportsScreen({ snapshot }: { snapshot: BookkeepingSnapshot }) {
  const [section, setSection] = useState<ReportSection>('profit-loss');
  const [fromDate, setFromDate] = useState(`${todayLocalDate().slice(0, 4)}-01-01`);
  const [throughDate, setThroughDate] = useState(todayLocalDate());
  const [report, setReport] = useState<CashBasisReport | null>(null);
  const [cashMovementReport, setCashMovementReport] = useState<CashMovementReport | null>(null);
  const [journalReport, setJournalReport] = useState<JournalBalanceReport | null>(null);
  const [ledgerReport, setLedgerReport] = useState<GeneralLedgerReport | null>(null);
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingKind, setExportingKind] = useState<'csv' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const reportDateRangeValid = isValidDateRange(fromDate, throughDate);
  const capitalInPeriod = reportDateRangeValid
    ? snapshot.capitalActivities.filter((activity) => activity.date >= fromDate && activity.date <= throughDate)
    : [];
  const cashContributionsCents = capitalInPeriod.filter((activity) => activity.kind === 'cash-contribution')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const propertyContributionsCents = capitalInPeriod.filter((activity) => activity.kind === 'property-contribution')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const distributionsCents = capitalInPeriod.filter((activity) => activity.kind === 'distribution')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const paymentEventsInPeriod = reportDateRangeValid
    ? snapshot.guaranteedPaymentCashEvents.filter((event) => event.date >= fromDate && event.date <= throughDate)
    : [];
  const servicesCashNetCents = paymentEventsInPeriod
    .filter((event) => event.classification === 'services')
    .reduce((sum, event) => sum + event.amountCents, 0n);
  const capitalUseCashNetCents = paymentEventsInPeriod
    .filter((event) => event.classification === 'use-of-capital')
    .reduce((sum, event) => sum + event.amountCents, 0n);
  const servicesPaidCents = paymentEventsInPeriod
    .filter((event) => event.classification === 'services' && event.kind === 'payment')
    .reduce((sum, event) => sum + event.amountCents, 0n);
  const servicesReturnedCents = paymentEventsInPeriod
    .filter((event) => event.classification === 'services' && event.kind === 'reversal')
    .reduce((sum, event) => sum - event.amountCents, 0n);
  const capitalUsePaidCents = paymentEventsInPeriod
    .filter((event) => event.classification === 'use-of-capital' && event.kind === 'payment')
    .reduce((sum, event) => sum + event.amountCents, 0n);
  const capitalUseReturnedCents = paymentEventsInPeriod
    .filter((event) => event.classification === 'use-of-capital' && event.kind === 'reversal')
    .reduce((sum, event) => sum - event.amountCents, 0n);
  const loanActivitiesInPeriod = reportDateRangeValid
    ? snapshot.loanActivities.filter((activity) => activity.date >= fromDate && activity.date <= throughDate)
    : [];
  const loanAdvancesInPeriodCents = loanActivitiesInPeriod.filter((activity) => activity.kind === 'advance')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const loanPrincipalRepaidInPeriodCents = loanActivitiesInPeriod
    .reduce((sum, activity) => sum + activity.principalCents, 0n);
  const loanInterestPaidInPeriodCents = loanActivitiesInPeriod
    .reduce((sum, activity) => sum + activity.interestCents, 0n);
  const loanSummaries = isValidDateRange(throughDate, throughDate)
    ? snapshot.loanAgreements.filter((loan) => loan.agreementDate <= throughDate).map((loan) => ({
      loan,
      summary: summarizeLoanBalance({
        commitmentCents: loan.commitmentCents,
        annualRateBasisPoints: loan.annualRateBasisPoints,
        dayCount: loan.dayCount,
        asOfDate: throughDate,
        activities: snapshot.loanActivities.filter((activity) => activity.loanId === loan.id).map((activity) => ({
          date: activity.date,
          kind: activity.kind,
          amountCents: activity.amountCents,
          principalCents: activity.principalCents,
          interestCents: activity.interestCents,
        })),
      }),
    }))
    : [];
  const memberLoanPrincipalCents = loanSummaries.filter(({ loan }) => loan.lenderType === 'member')
    .reduce((sum, { summary }) => sum + summary.principalOutstandingCents, 0n);
  const thirdPartyLoanPrincipalCents = loanSummaries.filter(({ loan }) => loan.lenderType === 'third-party')
    .reduce((sum, { summary }) => sum + summary.principalOutstandingCents, 0n);
  const loanInterestOutstandingCents = loanSummaries.reduce((sum, { summary }) => sum + summary.interestOutstandingCents, 0n);
  const selectedLedgerAccountId = snapshot.accounts.some((account) => account.id === ledgerAccountId)
    ? ledgerAccountId : snapshot.accounts[0]?.id ?? '';

  const refresh = async () => {
    if (!snapshot.business) return;
    if (!reportDateRangeValid) {
      setError('Enter valid dates in YYYY-MM-DD format, with From date on or before Through date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cashReport = await getCashBasisReport(snapshot.business.id, fromDate, throughDate);
      const movementReport = await getCashMovementReport(snapshot.business.id, fromDate, throughDate);
      const balanceReport = await getJournalBalanceReport(snapshot.business.id, throughDate);
      const generalLedger = selectedLedgerAccountId
        ? await getGeneralLedgerReport(snapshot.business.id, selectedLedgerAccountId, throughDate)
        : null;
      setReport(cashReport);
      setCashMovementReport(movementReport);
      setJournalReport(balanceReport);
      setLedgerReport(generalLedger);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'The report could not be calculated.');
    } finally {
      setLoading(false);
    }
  };

  const refreshLedger = async () => {
    if (!snapshot.business || !selectedLedgerAccountId) return;
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      setLedgerReport(await getGeneralLedgerReport(snapshot.business.id, selectedLedgerAccountId, throughDate));
    } catch (ledgerRefreshError) {
      setLedgerError(ledgerRefreshError instanceof Error ? ledgerRefreshError.message : 'The General Ledger could not be calculated.');
    } finally {
      setLedgerLoading(false);
    }
  };

  const exportCsv = async (reportName: string, csv: string) => {
    setExporting(true);
    setExportingKind('csv');
    setExportError(null);
    setExportNotice(null);
    try {
      const file = new File(Paths.cache, `llc-${reportName}-${todayLocalDate()}.csv`);
      file.create({ intermediates: true, overwrite: true });
      await file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${reportName.replaceAll('-', ' ')} CSV`,
      });
      setExportNotice('CSV prepared. The system share sheet controls whether a copy leaves this device.');
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : 'The report CSV could not be exported.');
    } finally {
      setExporting(false);
      setExportingKind(null);
    }
  };

  const exportPdf = async (reportName: string, title: string, period: string, csv: string) => {
    if (!snapshot.business) return;
    setExporting(true);
    setExportingKind('pdf');
    setExportError(null);
    setExportNotice(null);
    try {
      const html = buildReportPdfHtml({
        title,
        businessName: snapshot.business.name,
        period,
        csv,
      });
      const printOptions: Print.FilePrintOptions & { orientation: 'landscape' } = {
        html,
        ...REPORT_PDF_PAGE_SIZE,
      };
      const { uri } = await Print.printToFileAsync(printOptions);
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Export ${reportName.replaceAll('-', ' ')} PDF`,
      });
      setExportNotice('PDF prepared. The system share sheet controls whether a copy leaves this device.');
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : 'The report PDF could not be exported.');
    } finally {
      setExporting(false);
      setExportingKind(null);
    }
  };

  useEffect(() => { void refresh(); }, [snapshot.business?.id]);

  return <Page>
    <Heading title="Reports" subtitle="Cash-basis income and operating expenses are calculated from persisted journal lines. These reports are bookkeeping summaries, not tax returns." />
    <FormError message={exportError} />
    {exportNotice ? <Text style={uiStyles.helper}>{exportNotice}</Text> : null}
    <Choice label="Report" value={section} options={[
      { value: 'profit-loss', title: 'Profit & Loss' },
      { value: 'cash-movement', title: 'Cash movement' },
      { value: 'balance-sheet', title: 'Balance Sheet' },
      { value: 'trial-balance', title: 'Trial Balance' },
      { value: 'general-ledger', title: 'General Ledger' },
      { value: 'capital', title: 'Member capital' },
      { value: 'payments', title: 'Payments' },
      { value: 'loans', title: 'Loans' },
    ]} onChange={setSection} />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Reporting period</Text>
      <View style={uiStyles.row}>
        <Field label="From date" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Through date" value={throughDate} onChangeText={setThroughDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </View>
      <FormError message={reportDateRangeValid ? null : 'Enter valid dates in YYYY-MM-DD format, with From date on or before Through date.'} />
      <Button title={loading ? 'Calculating…' : 'Update report'} onPress={() => void refresh()} disabled={loading || ledgerLoading || !reportDateRangeValid} />
      <FormError message={error} />
    </Panel>
    {section === 'profit-loss' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Profit & loss · cash basis</Text>
      {report ? <>
        <Text style={uiStyles.rowDetail}>{report.fromDate} through {report.throughDate}</Text>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Income</Text><Money cents={report.incomeCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Operating expenses</Text><Money cents={report.expenseCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net income</Text><Money cents={report.netIncomeCents} /></View>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export P&L CSV'} secondary
          onPress={() => void exportCsv('profit-and-loss', cashBasisCsv(report))} disabled={exporting} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export P&L PDF'} secondary
          onPress={() => void exportPdf('profit-and-loss', 'Profit & Loss · Cash Basis', `${report.fromDate} through ${report.throughDate}`, cashBasisCsv(report))}
          disabled={exporting} />
      </> : <Text style={uiStyles.helper}>Choose a date range to calculate the report from journal activity.</Text>}
    </Panel>
    </> : null}
    {section === 'cash-movement' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Cash movement · selected dates</Text>
      {cashMovementReport && cashMovementReport.fromDate === fromDate && cashMovementReport.throughDate === throughDate ? <>
        <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate}. Transfers appear in each account's cash movement and net to zero across all accounts.</Text>
        {cashMovementReport.accounts.map((account) => <View key={account.accountId} style={uiStyles.loanCard}>
          <Text style={uiStyles.rowTitle}>{account.accountName} · {account.kind === 'bank' ? 'bank' : 'cash'}</Text>
          <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Beginning balance</Text><Money cents={account.beginningBalanceCents} /></View>
          <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Inflows</Text><Money cents={account.inflowsCents} /></View>
          <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Outflows</Text><Money cents={account.outflowsCents} /></View>
          <View style={uiStyles.reportRow}><Text style={uiStyles.rowDetail}>Net movement</Text><Money cents={account.netMovementCents} /></View>
          <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Ending balance</Text><Money cents={account.endingBalanceCents} /></View>
        </View>)}
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Total ending cash</Text><Money cents={cashMovementReport.endingBalanceCents} /></View>
        <Text style={uiStyles.rowDetail}>Beginning {moneyLabel(cashMovementReport.beginningBalanceCents)} + net movement {moneyLabel(cashMovementReport.netMovementCents)} = ending {moneyLabel(cashMovementReport.endingBalanceCents)}.</Text>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export cash movement CSV'} secondary
          onPress={() => void exportCsv('cash-movement', cashMovementCsv(cashMovementReport))}
          disabled={exporting || cashMovementReport.accounts.length === 0} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export cash movement PDF'} secondary
          onPress={() => void exportPdf('cash-movement', 'Cash Movement', `${fromDate} through ${throughDate}`, cashMovementCsv(cashMovementReport))}
          disabled={exporting || cashMovementReport.accounts.length === 0} />
        {cashMovementReport.accounts.length === 0 ? <Text style={uiStyles.helper}>Add a bank or cash account to report cash movement.</Text> : null}
      </> : <Text style={uiStyles.helper}>Update the report to calculate selected-period cash movement from journal lines.</Text>}
    </Panel>
    </> : null}
    {section === 'balance-sheet' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Balance Sheet · book basis</Text>
      {journalReport ? <>
        <Text style={uiStyles.rowDetail}>Cumulative journal balances through {journalReport.asOfDate}.</Text>
        <Text style={uiStyles.rowTitle}>Assets</Text>
        {journalReport.balanceSheet.assets.map((line) => <View key={line.accountId} style={uiStyles.reportRow}>
          <Text style={uiStyles.rowMain}>{line.name}</Text><Money cents={line.balanceCents} />
        </View>)}
        <View style={uiStyles.reportTotal}><Text style={uiStyles.rowTitle}>Total assets</Text><Money cents={journalReport.balanceSheet.totalAssetsCents} /></View>
        <Text style={uiStyles.rowTitle}>Liabilities</Text>
        {journalReport.balanceSheet.liabilities.map((line) => <View key={line.accountId} style={uiStyles.reportRow}>
          <Text style={uiStyles.rowMain}>{line.name}</Text><Money cents={line.balanceCents} />
        </View>)}
        <View style={uiStyles.reportTotal}><Text style={uiStyles.rowTitle}>Total liabilities</Text><Money cents={journalReport.balanceSheet.totalLiabilitiesCents} /></View>
        <Text style={uiStyles.rowTitle}>Equity</Text>
        {journalReport.balanceSheet.equity.map((line) => <View key={line.accountId} style={uiStyles.reportRow}>
          <Text style={uiStyles.rowMain}>{line.name}</Text><Money cents={line.balanceCents} />
        </View>)}
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Current earnings through date</Text><Money cents={journalReport.balanceSheet.currentEarningsCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.rowTitle}>Total equity</Text><Money cents={journalReport.balanceSheet.totalEquityCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Assets − liabilities − equity</Text><Money cents={journalReport.balanceSheet.differenceCents} /></View>
        <Text style={uiStyles.helper}>Current income and expenses are included as current earnings. No closing entries are generated. Book balances do not establish tax basis or outside basis.</Text>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export Balance Sheet CSV'} secondary
          onPress={() => void exportCsv('balance-sheet', balanceSheetCsv(journalReport))} disabled={exporting} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export Balance Sheet PDF'} secondary
          onPress={() => void exportPdf('balance-sheet', 'Balance Sheet · Book Basis', `Cumulative through ${journalReport.asOfDate}`, balanceSheetCsv(journalReport))}
          disabled={exporting} />
      </> : <Text style={uiStyles.helper}>Update the report to calculate journal balances.</Text>}
    </Panel>
    </> : null}
    {section === 'trial-balance' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Trial Balance</Text>
      {journalReport ? <>
        <Text style={uiStyles.rowDetail}>Account debit and credit balances through {journalReport.asOfDate}.</Text>
        <View style={uiStyles.reportRow}>
          <View style={uiStyles.rowMain}><Text style={uiStyles.rowTitle}>Account</Text></View>
          <View style={styles.trialBalanceAmount}><Text style={uiStyles.rowTitle}>Debit</Text></View>
          <View style={styles.trialBalanceAmount}><Text style={uiStyles.rowTitle}>Credit</Text></View>
        </View>
        {journalReport.trialBalance.map((line) => <View key={line.accountId} style={uiStyles.reportRow}>
          <View style={uiStyles.rowMain}><Text style={uiStyles.rowTitle}>{line.name}</Text><Text style={uiStyles.rowDetail}>{line.kind}</Text></View>
          <View style={styles.trialBalanceAmount}><Money cents={line.debitCents} /></View>
          <View style={styles.trialBalanceAmount}><Money cents={line.creditCents} /></View>
        </View>)}
        <View style={uiStyles.reportTotal}>
          <View style={uiStyles.rowMain}><Text style={uiStyles.rowTitle}>Totals</Text></View>
          <View style={styles.trialBalanceAmount}><Money cents={journalReport.totalDebitsCents} /></View>
          <View style={styles.trialBalanceAmount}><Money cents={journalReport.totalCreditsCents} /></View>
        </View>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export Trial Balance CSV'} secondary
          onPress={() => void exportCsv('trial-balance', trialBalanceCsv(journalReport))} disabled={exporting} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export Trial Balance PDF'} secondary
          onPress={() => void exportPdf('trial-balance', 'Trial Balance', `Cumulative through ${journalReport.asOfDate}`, trialBalanceCsv(journalReport))}
          disabled={exporting} />
      </> : <Text style={uiStyles.helper}>Update the report to calculate journal balances.</Text>}
    </Panel>
    </> : null}
    {section === 'general-ledger' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>General Ledger</Text>
      <Choice label="Account" value={selectedLedgerAccountId}
        options={snapshot.accounts.map((account) => ({ value: account.id, title: account.name }))}
        onChange={(accountId) => { setLedgerAccountId(accountId); setLedgerReport(null); setLedgerError(null); }} />
      <Button title={ledgerLoading ? 'Calculating…' : 'Update ledger'} onPress={() => void refreshLedger()} disabled={ledgerLoading || loading || !selectedLedgerAccountId || !isValidDateRange(throughDate, throughDate)} />
      <FormError message={ledgerError} />
      {ledgerReport ? <>
        <Text style={uiStyles.rowDetail}>{ledgerReport.accountName} · activity through {ledgerReport.asOfDate}</Text>
        {ledgerReport.lines.length ? ledgerReport.lines.map((line, index) => <View key={`${line.journalEntryId}:${index}`} style={uiStyles.reportRow}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{line.date} · {line.description}</Text>
            <Text style={uiStyles.rowDetail}>Debit {moneyLabel(line.debitCents)} · Credit {moneyLabel(line.creditCents)}</Text>
          </View>
          <Money cents={line.runningBalanceCents} />
        </View>) : <Text style={uiStyles.helper}>No journal activity is posted to this account through the selected date.</Text>}
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Total debits</Text><Money cents={ledgerReport.totalDebitsCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Total credits</Text><Money cents={ledgerReport.totalCreditsCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.rowTitle}>Ending balance · debit less credit</Text><Money cents={ledgerReport.endingBalanceCents} /></View>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export General Ledger CSV'} secondary
          onPress={() => void exportCsv('general-ledger', generalLedgerCsv(ledgerReport))} disabled={exporting} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export General Ledger PDF'} secondary
          onPress={() => void exportPdf('general-ledger', `General Ledger · ${ledgerReport.accountName}`, `Cumulative through ${ledgerReport.asOfDate}`, generalLedgerCsv(ledgerReport))}
          disabled={exporting} />
      </> : <Text style={uiStyles.helper}>Update the report to calculate account activity.</Text>}
    </Panel>
    </> : null}
    {section === 'capital' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Member capital movement · selected dates</Text>
      <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate} · book activity, not a tax basis report.</Text>
      {reportDateRangeValid ? <>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Cash contributions</Text><Money cents={cashContributionsCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Property contributions</Text><Money cents={propertyContributionsCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Member distributions</Text><Money cents={-distributionsCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net capital activity</Text><Money cents={cashContributionsCents + propertyContributionsCents - distributionsCents} /></View>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export capital movement CSV'} secondary
          onPress={() => void exportCsv('member-capital-movement', memberCapitalMovementCsv(fromDate, throughDate, capitalInPeriod))}
          disabled={exporting || capitalInPeriod.length === 0} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export capital movement PDF'} secondary
          onPress={() => void exportPdf('member-capital-movement', 'Member Capital Movement · Book Activity', `${fromDate} through ${throughDate}`, memberCapitalMovementCsv(fromDate, throughDate, capitalInPeriod))}
          disabled={exporting || capitalInPeriod.length === 0} />
        {capitalInPeriod.length === 0 ? <Text style={uiStyles.helper}>No member capital activity falls within these selected dates.</Text> : null}
      </> : <Text style={uiStyles.helper}>Enter a valid date range to calculate or export member capital activity.</Text>}
      {snapshot.memberCapitalSummaries.map((summary) => <View key={summary.memberId} style={uiStyles.reportRow}>
        <Text style={uiStyles.rowTitle}>{summary.memberName} · all-time book capital activity</Text>
        <Money cents={summary.bookCapitalActivityCents} />
      </View>)}
      {capitalInPeriod.some((activity) => activity.requiresCpaReview)
        ? <Text style={uiStyles.helper}>Property contribution valuation is flagged for CPA review. Book capital does not establish tax-basis capital or outside basis.</Text>
        : <Text style={uiStyles.helper}>Book capital does not establish tax-basis capital or outside basis.</Text>}
    </Panel>
    </> : null}
    {section === 'payments' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Guaranteed payment workpapers · cash dates</Text>
      {reportDateRangeValid ? <>
        <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate}. Only actual payments and returned funds appear here; unpaid obligations stay off the cash-basis P&L.</Text>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Services actually paid</Text><Money cents={servicesPaidCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Services returned</Text><Money cents={servicesReturnedCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net services cash expense</Text><Money cents={servicesCashNetCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Use-of-capital payments</Text><Money cents={capitalUsePaidCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Use-of-capital returns</Text><Money cents={capitalUseReturnedCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net use-of-capital cash expense</Text><Money cents={capitalUseCashNetCents} /></View>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export payment cash workpaper CSV'} secondary
          onPress={() => void exportCsv('guaranteed-payment-cash', guaranteedPaymentCashCsv(fromDate, throughDate, paymentEventsInPeriod))}
          disabled={exporting || paymentEventsInPeriod.length === 0} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export payment cash workpaper PDF'} secondary
          onPress={() => void exportPdf('guaranteed-payment-cash', 'Guaranteed Payment Cash Workpaper', `${fromDate} through ${throughDate}`, guaranteedPaymentCashCsv(fromDate, throughDate, paymentEventsInPeriod))}
          disabled={exporting || paymentEventsInPeriod.length === 0} />
        {paymentEventsInPeriod.length === 0 ? <Text style={uiStyles.helper}>No actual guaranteed-payment cash activity falls within these selected dates.</Text> : null}
        <Text style={uiStyles.helper}>This CSV contains only actual payment and reversal events. Unpaid obligations are omitted. Separate book categories only; CPA review is required for tax classification, deductibility, and capitalization. This is not a tax form.</Text>
      </> : <Text style={uiStyles.helper}>Enter a valid date range to calculate or export guaranteed-payment cash activity.</Text>}
    </Panel>
    </> : null}
    {section === 'loans' ? <>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Loan workpapers</Text>
      {reportDateRangeValid ? <>
        <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate} · loan balances as of the through date.</Text>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Funded advances during period · not income</Text><Money cents={loanAdvancesInPeriodCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Principal repaid during period · not expense</Text><Money cents={loanPrincipalRepaidInPeriodCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Interest actually paid during period</Text><Money cents={loanInterestPaidInPeriodCents} /></View>
        <Button title={exportingKind === 'csv' ? 'Preparing CSV…' : 'Export loan cash workpaper CSV'} secondary
          onPress={() => void exportCsv('loan-cash-activity', loanCashActivityCsv(fromDate, throughDate, loanActivitiesInPeriod, snapshot.loanAgreements))}
          disabled={exporting || loanActivitiesInPeriod.length === 0} />
        <Button title={exportingKind === 'pdf' ? 'Preparing PDF…' : 'Export loan cash workpaper PDF'} secondary
          onPress={() => void exportPdf('loan-cash-activity', 'Loan Cash Workpaper', `${fromDate} through ${throughDate} · balances as of ${throughDate}`, loanCashActivityCsv(fromDate, throughDate, loanActivitiesInPeriod, snapshot.loanAgreements))}
          disabled={exporting || loanActivitiesInPeriod.length === 0} />
        {loanActivitiesInPeriod.length === 0 ? <Text style={uiStyles.helper}>No loan cash activity falls within these selected dates.</Text> : null}
      </> : <Text style={uiStyles.helper}>Enter a valid date range to calculate loan activity totals.</Text>}
      {isValidDateRange(throughDate, throughDate) ? <>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Member loan principal outstanding</Text><Money cents={memberLoanPrincipalCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Third-party loan principal outstanding</Text><Money cents={thirdPartyLoanPrincipalCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Accrued interest remaining · estimate</Text><Money cents={loanInterestOutstandingCents} /></View>
        {loanSummaries.map(({ loan, summary }) => <View key={loan.id} style={uiStyles.reportRow}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{loan.lenderType === 'member' ? 'Member' : 'Third party'} · {loan.lenderName}</Text>
            <Text style={uiStyles.rowDetail}>Commitment left {moneyLabel(summary.commitmentRemainingCents)} · {rateLabel(loan.annualRateBasisPoints)} · {loan.dayCount}</Text>
          </View>
          <Money cents={summary.principalOutstandingCents} />
        </View>)}
      </> : <Text style={uiStyles.helper}>Enter a valid through date to calculate loan balances.</Text>}
      <Text style={uiStyles.helper}>Commitments are not cash advances. Loan proceeds are not income, principal repayments are not expenses, and only paid interest appears in cash-basis expenses. Accrued interest is a bookkeeping estimate; this report does not select rates or determine tax deductibility.</Text>
    </Panel>
    </> : null}
    <Panel>
      <Text style={uiStyles.sectionTitle}>Available from persisted books</Text>
      <Text style={uiStyles.rowDetail}>Account balances: {snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash').length} bank and cash accounts.</Text>
      <Text style={uiStyles.rowDetail}>Member interests: {snapshot.members.length} current members, with dated interest history.</Text>
      <Text style={uiStyles.helper}>P&L, Balance Sheet, Trial Balance, selected-account General Ledger, member capital, guaranteed-payment cash, and loan cash workpapers are available as CSV and PDF. These are bookkeeping workpapers, not tax returns.</Text>
    </Panel>
  </Page>;
}

const styles = StyleSheet.create({
  trialBalanceAmount: { width: 88, alignItems: 'flex-end' },
});

function moneyLabel(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  return `$${whole.toLocaleString('en-US')}.${fraction}`;
}

function rateLabel(basisPoints: number): string {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}%`;
}
