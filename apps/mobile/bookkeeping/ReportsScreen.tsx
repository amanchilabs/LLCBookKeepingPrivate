import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getCashBasisReport } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, CashBasisReport } from '../../../packages/storage-native/src/bookkeeping-store';
import { summarizeLoanBalance } from '../../../packages/domain/src/loan-interest';
import { Button, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

export function ReportsScreen({ snapshot }: { snapshot: BookkeepingSnapshot }) {
  const [fromDate, setFromDate] = useState(`${todayLocalDate().slice(0, 4)}-01-01`);
  const [throughDate, setThroughDate] = useState(todayLocalDate());
  const [report, setReport] = useState<CashBasisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capitalInPeriod = snapshot.capitalActivities.filter((activity) => activity.date >= fromDate && activity.date <= throughDate);
  const cashContributionsCents = capitalInPeriod.filter((activity) => activity.kind === 'cash-contribution')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const propertyContributionsCents = capitalInPeriod.filter((activity) => activity.kind === 'property-contribution')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const distributionsCents = capitalInPeriod.filter((activity) => activity.kind === 'distribution')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const paymentEventsInPeriod = snapshot.guaranteedPaymentCashEvents
    .filter((event) => event.date >= fromDate && event.date <= throughDate);
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
  const loanActivitiesInPeriod = snapshot.loanActivities.filter((activity) => activity.date >= fromDate && activity.date <= throughDate);
  const loanAdvancesInPeriodCents = loanActivitiesInPeriod.filter((activity) => activity.kind === 'advance')
    .reduce((sum, activity) => sum + activity.amountCents, 0n);
  const loanPrincipalRepaidInPeriodCents = loanActivitiesInPeriod
    .reduce((sum, activity) => sum + activity.principalCents, 0n);
  const loanInterestPaidInPeriodCents = loanActivitiesInPeriod
    .reduce((sum, activity) => sum + activity.interestCents, 0n);
  const loanSummaries = isValidDate(throughDate)
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

  const refresh = async () => {
    if (!snapshot.business) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await getCashBasisReport(snapshot.business.id, fromDate, throughDate));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'The report could not be calculated.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [snapshot.business?.id]);

  return <Page>
    <Heading title="Reports" subtitle="Cash-basis income and operating expenses are calculated from persisted journal lines. These reports are bookkeeping summaries, not tax returns." />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Profit & loss · cash basis</Text>
      <View style={uiStyles.row}>
        <Field label="From date" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Through date" value={throughDate} onChangeText={setThroughDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </View>
      <Button title={loading ? 'Calculating…' : 'Update report'} onPress={() => void refresh()} disabled={loading} />
      <FormError message={error} />
      {report ? <>
        <Text style={uiStyles.rowDetail}>{report.fromDate} through {report.throughDate}</Text>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Income</Text><Money cents={report.incomeCents} /></View>
        <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Operating expenses</Text><Money cents={report.expenseCents} /></View>
        <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net income</Text><Money cents={report.netIncomeCents} /></View>
      </> : <Text style={uiStyles.helper}>Choose a date range to calculate the report from journal activity.</Text>}
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Member capital movement · selected dates</Text>
      <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate} · book activity, not a tax basis report.</Text>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Cash contributions</Text><Money cents={cashContributionsCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Property contributions</Text><Money cents={propertyContributionsCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Member distributions</Text><Money cents={-distributionsCents} /></View>
      <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net capital activity</Text><Money cents={cashContributionsCents + propertyContributionsCents - distributionsCents} /></View>
      {snapshot.memberCapitalSummaries.map((summary) => <View key={summary.memberId} style={uiStyles.reportRow}>
        <Text style={uiStyles.rowTitle}>{summary.memberName} · all-time book capital activity</Text>
        <Money cents={summary.bookCapitalActivityCents} />
      </View>)}
      {capitalInPeriod.some((activity) => activity.requiresCpaReview)
        ? <Text style={uiStyles.helper}>Property contribution valuation is flagged for CPA review. Book capital does not establish tax-basis capital or outside basis.</Text>
        : <Text style={uiStyles.helper}>Book capital does not establish tax-basis capital or outside basis.</Text>}
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Guaranteed payment workpapers · cash dates</Text>
      <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate}. Only actual payments and returned funds appear here; unpaid obligations stay off the cash-basis P&L.</Text>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Services actually paid</Text><Money cents={servicesPaidCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Services returned</Text><Money cents={servicesReturnedCents} /></View>
      <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net services cash expense</Text><Money cents={servicesCashNetCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Use-of-capital payments</Text><Money cents={capitalUsePaidCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Use-of-capital returns</Text><Money cents={capitalUseReturnedCents} /></View>
      <View style={uiStyles.reportTotal}><Text style={uiStyles.sectionTitle}>Net use-of-capital cash expense</Text><Money cents={capitalUseCashNetCents} /></View>
      <Text style={uiStyles.helper}>Separate book categories only. CPA review is required for tax classification, deductibility, and capitalization. This workpaper is not a tax form.</Text>
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Loan workpapers</Text>
      <Text style={uiStyles.rowDetail}>{fromDate} through {throughDate} · loan balances as of the through date.</Text>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Funded advances during period · not income</Text><Money cents={loanAdvancesInPeriodCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Principal repaid during period · not expense</Text><Money cents={loanPrincipalRepaidInPeriodCents} /></View>
      <View style={uiStyles.reportRow}><Text style={uiStyles.rowTitle}>Interest actually paid during period</Text><Money cents={loanInterestPaidInPeriodCents} /></View>
      {isValidDate(throughDate) ? <>
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
      <Text style={uiStyles.helper}>Only paid interest appears in cash-basis expenses. Accrued interest is a bookkeeping estimate; this report does not select rates or determine tax deductibility.</Text>
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Available from persisted books</Text>
      <Text style={uiStyles.rowDetail}>Account balances: {snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash').length} bank and cash accounts.</Text>
      <Text style={uiStyles.rowDetail}>Member interests: {snapshot.members.length} current members, with dated interest history.</Text>
      <Text style={uiStyles.helper}>Trial Balance, General Ledger, Balance Sheet and tax-specific reports are still to come.</Text>
    </Panel>
  </Page>;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function moneyLabel(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  return `$${whole.toLocaleString('en-US')}.${fraction}`;
}

function rateLabel(basisPoints: number): string {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}%`;
}
