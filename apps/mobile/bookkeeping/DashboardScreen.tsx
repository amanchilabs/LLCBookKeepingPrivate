import React from 'react';
import { Text, View } from 'react-native';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import type { AppDestination } from './navigation-model';
import {
  Button,
  EmptyState,
  FinancialSummaryTile,
  Heading,
  MemberSummaryCard,
  Money,
  Page,
  Panel,
  TransactionSummaryRow,
  todayLocalDate,
  uiStyles,
} from './ui';

type EntryKind = 'income' | 'expense' | 'transfer';

export function DashboardScreen({
  snapshot,
  onNavigate,
  onRecordTransaction,
}: {
  snapshot: BookkeepingSnapshot;
  onNavigate: (destination: AppDestination) => void;
  onRecordTransaction: (kind: EntryKind) => void;
}) {
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const cashBalance = cashAccounts.reduce((sum, account) => sum + account.balanceCents, 0n);
  const openReminders = snapshot.reminders.filter((reminder) => !reminder.isComplete);

  return <Page>
    <Heading title="Books at a glance" subtitle="Balances and totals come from this LLC’s persisted journal." />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Record an activity</Text>
      <View style={uiStyles.row}>
        <Button title="Record income" onPress={() => onRecordTransaction('income')} />
        <Button title="Record expense" secondary onPress={() => onRecordTransaction('expense')} />
        <Button title="Transfer" secondary onPress={() => onRecordTransaction('transfer')} />
      </View>
    </Panel>
    <Panel style={heroPanel}>
      <Text style={uiStyles.rowDetail}>Cash across bank and cash accounts</Text>
      <Money cents={cashBalance} size="large" />
      <Text style={uiStyles.helper}>Current book balance · {todayLocalDate()}</Text>
      <View style={uiStyles.row}>
        <Button title="View accounts" secondary onPress={() => onNavigate('Accounts')} />
        <Button title="Reconcile" secondary onPress={() => onNavigate('Accounts')} />
      </View>
    </Panel>

    <View style={uiStyles.row}>
      <FinancialSummaryTile label="Cash-basis income" cents={snapshot.cashBasis.incomeCents} />
      <FinancialSummaryTile label="Cash-basis expenses" cents={snapshot.cashBasis.expenseCents} />
      <FinancialSummaryTile label="Net income" cents={snapshot.cashBasis.netIncomeCents} />
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
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{account.name}</Text>
          <Text style={uiStyles.rowDetail}>{account.kind === 'bank' ? 'Bank account' : 'Cash account'}</Text>
        </View>
        <Money cents={account.balanceCents} />
      </View>) : <EmptyState
        title="No bank or cash accounts yet"
        body="Add an account to record income, expenses, or an opening balance."
        action={<Button title="Create an account" onPress={() => onNavigate('Accounts')} />}
      />}
    </Panel>

    <Panel>
      <View style={uiStyles.headingRow}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.sectionTitle}>Recent activity</Text>
          <Text style={uiStyles.rowDetail}>Posted transactions and opening balances</Text>
        </View>
        <Button title="All transactions" secondary onPress={() => onNavigate('Transactions')} />
      </View>
      {snapshot.transactions.slice(0, 5).map((transaction) => <TransactionSummaryRow
        key={transaction.id}
        title={transaction.description}
        date={transaction.date}
        category={transaction.category}
        account={transaction.accountName}
        role={transaction.kind === 'opening-balance' ? 'Opening balance' : transaction.kind}
        cents={transaction.amountCents}
      />)}
      {!snapshot.transactions.length ? <EmptyState
        title="No activity recorded"
        body="Create an account, enter an opening balance if needed, then record the first transaction."
        action={<Button title="Record income" onPress={() => onRecordTransaction('income')} />}
      /> : null}
    </Panel>

    <Panel>
      <View style={uiStyles.headingRow}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.sectionTitle}>Members</Text>
          <Text style={uiStyles.rowDetail}>Ownership interests are shown separately from capital activity.</Text>
        </View>
        <Button title="Manage members" secondary onPress={() => onNavigate('Members')} />
      </View>
      {snapshot.members.map((member) => {
        const capital = snapshot.memberCapitalSummaries.find((summary) => summary.memberId === member.id)?.bookCapitalActivityCents;
        return <MemberSummaryCard
          key={member.id}
          name={member.name}
          ownership={formatPercent(member.ownershipBasisPoints)}
          capitalCents={capital}
        />;
      })}
    </Panel>

    <Panel>
      <View style={uiStyles.headingRow}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.sectionTitle}>Reminders</Text>
          <Text style={uiStyles.rowDetail}>Local notes only; reminders do not post journal entries.</Text>
        </View>
        <Button title="Manage" secondary onPress={() => onNavigate('Settings')} />
      </View>
      {openReminders.slice(0, 4).map((reminder) => <View key={reminder.id} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{reminder.title}</Text>
          <Text style={uiStyles.rowDetail}>{reminder.dueDate} · {reminder.dueDate < todayLocalDate() ? 'Overdue' : 'Upcoming'}</Text>
        </View>
      </View>)}
      {openReminders.length === 0 ? <EmptyState title="No open reminders" body="Saved local reminders will appear here." /> : null}
    </Panel>

    <Panel>
      <Text style={uiStyles.sectionTitle}>Reports</Text>
      <Text style={uiStyles.rowDetail}>Open a dated cash-basis or book-basis report from persisted records.</Text>
      <Button title="View reports" secondary onPress={() => onNavigate('Reports')} />
    </Panel>
  </Page>;
}

function formatPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}

const heroPanel = { backgroundColor: '#FFFDF8', borderColor: '#D8E4DA' };
