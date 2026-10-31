import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getCashBasisReport } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, CashBasisReport } from '../../../packages/storage-native/src/bookkeeping-store';
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
      <Text style={uiStyles.sectionTitle}>Available from persisted books</Text>
      <Text style={uiStyles.rowDetail}>Account balances: {snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash').length} bank and cash accounts.</Text>
      <Text style={uiStyles.rowDetail}>Member interests: {snapshot.members.length} current members, with dated interest history.</Text>
      <Text style={uiStyles.helper}>Trial Balance, General Ledger, Balance Sheet and tax-specific reports are still to come.</Text>
    </Panel>
  </Page>;
}
