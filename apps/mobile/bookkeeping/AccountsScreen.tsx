import * as Crypto from 'expo-crypto';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { parseUsd } from '../../../packages/domain/src/money';
import { findDraftForAccount, selectBankAccountId } from './account-reconciliation-selection';
import {
  completeAccountReconciliation,
  createAccountReconciliation,
  createCashAccount,
  reopenAccountReconciliation,
  setAccountReconciliationItemCleared,
} from '../../../packages/storage-native/src/bookkeeping-service';
import type { AccountRecord, BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

type CashKind = 'bank' | 'cash';

export function AccountsScreen({ snapshot, onSaved }: { snapshot: BookkeepingSnapshot; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CashKind>('bank');
  const [openingText, setOpeningText] = useState('');
  const [openingDate, setOpeningDate] = useState(todayLocalDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconciliationAccountId, setReconciliationAccountId] = useState('');
  const [periodStartDate, setPeriodStartDate] = useState(snapshot.business?.bookkeepingStartDate ?? todayLocalDate());
  const [statementDate, setStatementDate] = useState(todayLocalDate());
  const [beginningBalanceText, setBeginningBalanceText] = useState('');
  const [endingBalanceText, setEndingBalanceText] = useState('');
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [reconciliationBusy, setReconciliationBusy] = useState(false);
  const cashAccounts = snapshot.accounts.filter(isCashAccount);
  const bankAccounts = snapshot.accounts.filter((account) => account.kind === 'bank');
  const selectedBankAccountId = selectBankAccountId(bankAccounts, snapshot.accountReconciliations, reconciliationAccountId);
  const activeReconciliation = findDraftForAccount(snapshot.accountReconciliations, selectedBankAccountId);
  const latestCompletedReconciliation = snapshot.accountReconciliations
    .filter((item) => item.accountId === selectedBankAccountId && item.status === 'completed')
    .sort((left, right) => right.statementDate.localeCompare(left.statementDate))[0];

  useEffect(() => {
    if (activeReconciliation) return;
    if (latestCompletedReconciliation) {
      setPeriodStartDate(latestCompletedReconciliation.statementDate);
      setBeginningBalanceText(centsToInput(latestCompletedReconciliation.endingBalanceCents));
    } else {
      setPeriodStartDate(snapshot.business?.bookkeepingStartDate ?? todayLocalDate());
      setBeginningBalanceText('');
    }
  }, [activeReconciliation, latestCompletedReconciliation, selectedBankAccountId, snapshot.business?.bookkeepingStartDate]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const openingBalanceCents = parseSignedAmount(openingText);
      if (kind === 'cash' && openingBalanceCents < 0n) throw new Error('A cash account opening balance cannot be negative.');
      const accountId = Crypto.randomUUID();
      await createCashAccount({
        id: accountId,
        businessId: snapshot.business!.id,
        name,
        kind,
        openingDate: openingBalanceCents === 0n ? undefined : openingDate,
        openingBalanceCents,
        openingTransactionId: openingBalanceCents === 0n ? undefined : Crypto.randomUUID(),
        openingJournalEntryId: openingBalanceCents === 0n ? undefined : Crypto.randomUUID(),
      });
      setName('');
      setOpeningText('');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The account could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const startReconciliation = async () => {
    setReconciliationBusy(true);
    setReconciliationError(null);
    try {
      if (!selectedBankAccountId) throw new Error('Create a bank account before starting a reconciliation.');
      await createAccountReconciliation({
        id: Crypto.randomUUID(), businessId: snapshot.business!.id, accountId: selectedBankAccountId,
        periodStartDate, statementDate,
        beginningBalanceCents: parseSignedAmount(beginningBalanceText),
        endingBalanceCents: parseSignedAmount(endingBalanceText),
      });
      await onSaved();
    } catch (reconciliationSaveError) {
      setReconciliationError(reconciliationSaveError instanceof Error
        ? reconciliationSaveError.message : 'The reconciliation could not be started.');
    } finally {
      setReconciliationBusy(false);
    }
  };

  const updateClearedItem = async (reconciliationId: string, transactionId: string, cleared: boolean) => {
    setReconciliationBusy(true);
    setReconciliationError(null);
    try {
      await setAccountReconciliationItemCleared(reconciliationId, transactionId, cleared);
      await onSaved();
    } catch (reconciliationSaveError) {
      setReconciliationError(reconciliationSaveError instanceof Error
        ? reconciliationSaveError.message : 'The cleared status could not be saved.');
    } finally {
      setReconciliationBusy(false);
    }
  };

  const completeReconciliation = async (reconciliationId: string) => {
    setReconciliationBusy(true);
    setReconciliationError(null);
    try {
      await completeAccountReconciliation(reconciliationId);
      await onSaved();
    } catch (reconciliationSaveError) {
      setReconciliationError(reconciliationSaveError instanceof Error
        ? reconciliationSaveError.message : 'The reconciliation could not be completed.');
    } finally {
      setReconciliationBusy(false);
    }
  };

  const reopenReconciliation = async (reconciliationId: string) => {
    setReconciliationBusy(true);
    setReconciliationError(null);
    try {
      await reopenAccountReconciliation(reconciliationId);
      await onSaved();
    } catch (reconciliationSaveError) {
      setReconciliationError(reconciliationSaveError instanceof Error
        ? reconciliationSaveError.message : 'The reconciliation could not be reopened.');
    } finally {
      setReconciliationBusy(false);
    }
  };

  return <Page>
    <Heading title="Accounts" subtitle="Balances are calculated from posted journal lines. Opening balances use Opening Balance Equity as the offset." />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Create a bank or cash account</Text>
      <Choice label="Account type" value={kind} options={[{ value: 'bank', title: 'Bank' }, { value: 'cash', title: 'Cash' }]} onChange={setKind} />
      <Field label="Account name" value={name} onChangeText={setName} placeholder={kind === 'bank' ? 'Operating checking' : 'Petty cash'} autoCapitalize="words" />
      <Field label="Opening balance in USD" value={openingText} onChangeText={setOpeningText} placeholder="0.00" keyboardType="decimal-pad" />
      <Text style={uiStyles.helper}>Leave the amount blank for a zero balance. A negative opening balance is allowed for a bank overdraft and posts against Opening Balance Equity.</Text>
      {openingText.trim() && openingText.trim() !== '0' && openingText.trim() !== '0.00'
        ? <Field label="Opening balance date" value={openingDate} onChangeText={setOpeningDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        : null}
      <FormError message={error} />
      <Button title="Save account" onPress={() => void save()} disabled={saving} />
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Cash and bank balances</Text>
      {cashAccounts.length ? cashAccounts.map((account) => <AccountRow key={account.id} account={account} />)
        : <Text style={uiStyles.helper}>No bank or cash accounts yet. Create one above to start recording activity.</Text>}
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Manual bank reconciliation</Text>
      <Text style={uiStyles.helper}>Match posted journal activity to a bank statement. Reconciliation never changes account balances or income and expenses.</Text>
      {bankAccounts.length ? <Choice label="Bank account" value={selectedBankAccountId} options={bankAccounts.map((account) => ({ value: account.id, title: account.name }))} onChange={setReconciliationAccountId} /> : null}
      {activeReconciliation ? <ActiveReconciliation
        reconciliation={activeReconciliation}
        events={snapshot.accountReconciliationEvents.filter((event) => event.reconciliationId === activeReconciliation.id)}
        busy={reconciliationBusy}
        onToggle={(transactionId, cleared) => void updateClearedItem(activeReconciliation.id, transactionId, cleared)}
        onComplete={() => void completeReconciliation(activeReconciliation.id)}
      /> : bankAccounts.length ? <>
        <Field label="Statement period starts" value={periodStartDate} onChangeText={setPeriodStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Statement date" value={statementDate} onChangeText={setStatementDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Beginning statement balance in USD" value={beginningBalanceText} onChangeText={setBeginningBalanceText} placeholder="0.00" keyboardType="decimal-pad" />
        <Field label="Ending statement balance in USD" value={endingBalanceText} onChangeText={setEndingBalanceText} placeholder="0.00" keyboardType="decimal-pad" />
        {latestCompletedReconciliation ? <Text style={uiStyles.helper}>The period starts at the previous statement date and the beginning balance carries forward from its ending balance.</Text> : null}
        <Button title="Start reconciliation" onPress={() => void startReconciliation()} disabled={reconciliationBusy} />
      </> : <Text style={uiStyles.helper}>Create a bank account before reconciling a statement.</Text>}
      <FormError message={reconciliationError} />
      {snapshot.accountReconciliations.length ? <>
        <Text style={uiStyles.sectionTitle}>Statement history</Text>
        {snapshot.accountReconciliations.filter((item) => item.accountId === selectedBankAccountId).map((item) => <View key={item.id} style={uiStyles.rowItem}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{item.accountName} · {item.statementDate}</Text>
            <Text style={uiStyles.rowDetail}>{item.status === 'completed' ? 'Completed' : 'In progress'} · difference </Text>
          </View>
          <Money cents={item.differenceCents} />
          {item.status === 'completed' && item.id === latestCompletedReconciliation?.id
            ? <Button title="Reopen" secondary onPress={() => void reopenReconciliation(item.id)} disabled={reconciliationBusy} /> : null}
        </View>)}
      </> : null}
    </Panel>
  </Page>;
}

function ActiveReconciliation({
  reconciliation, events, busy, onToggle, onComplete,
}: {
  reconciliation: BookkeepingSnapshot['accountReconciliations'][number];
  events: BookkeepingSnapshot['accountReconciliationEvents'];
  busy: boolean;
  onToggle: (transactionId: string, cleared: boolean) => void;
  onComplete: () => void;
}) {
  return <>
    <Text style={uiStyles.rowDetail}>{reconciliation.accountName} · {reconciliation.periodStartDate} to {reconciliation.statementDate}</Text>
    <View style={uiStyles.rowItem}><Text style={uiStyles.rowMain}>Beginning balance</Text><Money cents={reconciliation.beginningBalanceCents} /></View>
    <View style={uiStyles.rowItem}><Text style={uiStyles.rowMain}>Cleared activity</Text><Money cents={reconciliation.clearedMovementCents} /></View>
    <View style={uiStyles.rowItem}><Text style={uiStyles.rowMain}>Statement ending balance</Text><Money cents={reconciliation.endingBalanceCents} /></View>
    <View style={uiStyles.rowItem}><Text style={uiStyles.rowMain}>Difference</Text><Money cents={reconciliation.differenceCents} /></View>
    <Text style={uiStyles.sectionTitle}>Select transactions shown on the statement</Text>
    {reconciliation.activities.length ? reconciliation.activities.map((activity) => <View key={activity.transactionId} style={uiStyles.rowItem}>
      <View style={uiStyles.rowMain}>
        <Text style={uiStyles.rowTitle}>{activity.description}</Text>
        <Text style={uiStyles.rowDetail}>{activity.date} · <Money cents={activity.amountCents} /></Text>
      </View>
      <Button title={activity.cleared ? '✓ Cleared' : 'Mark cleared'} secondary
        onPress={() => onToggle(activity.transactionId, !activity.cleared)} disabled={busy} />
    </View>) : <Text style={uiStyles.helper}>No unreconciled activity is available through this statement date.</Text>}
    <Button title="Complete reconciliation" onPress={onComplete} disabled={busy || reconciliation.differenceCents !== 0n} />
    {events.length ? <Text style={uiStyles.helper}>Audit: {events.map((event) => event.eventType.replaceAll('-', ' ')).join(' · ')}</Text> : null}
  </>;
}

function AccountRow({ account }: { account: AccountRecord }) {
  return <View style={uiStyles.rowItem}>
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.rowTitle}>{account.name}</Text>
      <Text style={uiStyles.rowDetail}>{account.kind === 'bank' ? 'Bank account' : 'Cash account'}</Text>
    </View>
    <Money cents={account.balanceCents} />
  </View>;
}

function isCashAccount(account: AccountRecord): boolean {
  return account.kind === 'bank' || account.kind === 'cash';
}

function parseSignedAmount(text: string): bigint {
  const normalized = text.trim();
  if (!normalized) return 0n;
  if (normalized.startsWith('-')) return -parseUsd(normalized.slice(1));
  if (normalized.startsWith('+')) throw new Error('Enter the opening balance without a plus sign.');
  return parseUsd(normalized);
}

function centsToInput(cents: bigint): string {
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}
