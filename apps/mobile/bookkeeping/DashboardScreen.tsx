import React from 'react';
import { Text, View } from 'react-native';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Heading, Money, Page, Panel, uiStyles } from './ui';

export function DashboardScreen({
  snapshot,
  onNavigate,
}: {
  snapshot: BookkeepingSnapshot;
  onNavigate: (screen: 'Transactions' | 'Accounts' | 'Members' | 'Reports') => void;
}) {
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const cashBalance = cashAccounts.reduce((sum, account) => sum + account.balanceCents, 0n);
  return <Page>
    <Heading title="Books at a glance" subtitle="All totals below come from the locally stored journal." />
    <Panel>
      <Text style={uiStyles.fieldLabel}>Cash across bank and cash accounts</Text>
      <Money cents={cashBalance} size="large" />
      <View style={uiStyles.row}>
        <Button title="View accounts" secondary onPress={() => onNavigate('Accounts')} />
        <Button title="Record activity" onPress={() => onNavigate('Transactions')} />
      </View>
    </Panel>
    <View style={uiStyles.row}>
      <Panel style={uiStyles.metricPanel}>
        <Text style={uiStyles.rowDetail}>Cash-basis income</Text>
        <Money cents={snapshot.cashBasis.incomeCents} />
      </Panel>
      <Panel style={uiStyles.metricPanel}>
        <Text style={uiStyles.rowDetail}>Cash-basis expenses</Text>
        <Money cents={snapshot.cashBasis.expenseCents} />
      </Panel>
    </View>
    <Panel>
      <View style={uiStyles.headingRow}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.sectionTitle}>Accounts</Text>
          <Text style={uiStyles.rowDetail}>Calculated from balanced journal lines</Text>
        </View>
        <Button title="Manage" secondary onPress={() => onNavigate('Accounts')} />
      </View>
      {cashAccounts.length ? cashAccounts.map((account) => <View key={account.id} style={uiStyles.rowItem}>
        <Text style={uiStyles.rowTitle}>{account.name}</Text><Money cents={account.balanceCents} />
      </View>) : <Text style={uiStyles.helper}>Create a bank or cash account to start.</Text>}
    </Panel>
    <Panel>
      <View style={uiStyles.headingRow}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.sectionTitle}>Recent activity</Text>
          <Text style={uiStyles.rowDetail}>Posted transactions and opening balances</Text>
        </View>
        <Button title="All" secondary onPress={() => onNavigate('Transactions')} />
      </View>
      {snapshot.transactions.slice(0, 5).map((transaction) => <View key={transaction.id} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{transaction.description}</Text>
          <Text style={uiStyles.rowDetail}>{transaction.date} · {transaction.category} · {transaction.accountName}</Text>
        </View>
        <Money cents={transaction.amountCents} />
      </View>)}
      {!snapshot.transactions.length ? <Text style={uiStyles.helper}>No entries yet. Record an opening balance when you create your first account.</Text> : null}
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Members</Text>
      {snapshot.members.map((member) => <View key={member.id} style={uiStyles.rowItem}>
        <Text style={uiStyles.rowTitle}>{member.name}</Text>
        <Text style={uiStyles.badge}>{formatPercent(member.ownershipBasisPoints)}%</Text>
      </View>)}
      <Button title="Manage members" secondary onPress={() => onNavigate('Members')} />
      <Button title="Open cash-basis report" secondary onPress={() => onNavigate('Reports')} />
    </Panel>
  </Page>;
}

function formatPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
