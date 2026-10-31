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
      <Text style={uiStyles.sectionTitle}>Available from persisted books</Text>
      <Text style={uiStyles.rowDetail}>Account balances: {snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash').length} bank and cash accounts.</Text>
      <Text style={uiStyles.rowDetail}>Member interests: {snapshot.members.length} current members, with dated interest history.</Text>
      <Text style={uiStyles.helper}>Trial Balance, General Ledger, Balance Sheet, member capital and tax-specific reports are not part of this first reporting slice.</Text>
    </Panel>
  </Page>;
}
