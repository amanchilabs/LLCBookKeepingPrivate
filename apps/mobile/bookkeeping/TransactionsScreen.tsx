import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { parseUsd } from '../../../packages/domain/src/money';
import { RecurringTransactionsSection } from './RecurringTransactionsSection';
import { transactionRoleLabel } from './transaction-role';
import { transactionWorkspaceSections, type TransactionWorkspaceSection } from './transaction-workspace';
import { TransactionCsvImportPanel } from './TransactionCsvImportPanel';
import {
  correctCashTransaction,
  recordCashTransaction,
  recordSplitCashTransaction,
  recordTransfer,
} from '../../../packages/storage-native/src/bookkeeping-service';
import {
  transactionsCsv,
  type AccountRecord,
  type BookkeepingSnapshot,
  type TransactionRecord,
} from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, StatusIndicator, todayLocalDate, uiStyles } from './ui';

type EntryKind = 'income' | 'expense' | 'transfer';
type KindFilter = 'all' | EntryKind | 'loan-advance' | 'loan-repayment';
interface DraftSplit {
  id: string;
  categoryAccountId: string;
  amount: string;
}
interface TransactionDraft {
  kind: EntryKind;
  date: string;
  accountId: string;
  categoryAccountId: string;
  amount: string;
  description: string;
  splits: DraftSplit[] | null;
}

export function TransactionsScreen({
  snapshot,
  onSaved,
  initialKind,
  initialSection = 'history',
  onInitialKindHandled,
}: {
  snapshot: BookkeepingSnapshot;
  onSaved: () => Promise<void>;
  initialKind?: EntryKind | null;
  initialSection?: TransactionWorkspaceSection;
  onInitialKindHandled?: () => void;
}) {
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const [correcting, setCorrecting] = useState<TransactionRecord | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [section, setSection] = useState<TransactionWorkspaceSection>(initialSection);

  const categories = draft?.kind === 'transfer'
    ? cashAccounts
    : snapshot.accounts.filter((account) => account.kind === (draft?.kind ?? 'income'));
  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return snapshot.transactions.filter((transaction) => {
      const matchesKind = kindFilter === 'all' || transaction.kind === kindFilter;
      const matchesAccount = accountFilter === 'all' || transaction.accountId === accountFilter
        || (transaction.transferRole !== null && transaction.categoryAccountId === accountFilter);
      const matchesCategory = categoryFilter === 'all' || transaction.categoryAccountId === categoryFilter
        || transaction.splitLines?.some((split) => split.categoryAccountId === categoryFilter) === true;
      const matchesSearch = !query || [transaction.description, transaction.category, transaction.accountName, transaction.date]
        .some((value) => value.toLowerCase().includes(query));
      return matchesKind && matchesAccount && matchesCategory && matchesSearch;
    });
  }, [snapshot.transactions, kindFilter, accountFilter, categoryFilter, search]);

  const beginNew = (kind: EntryKind = 'income') => {
    setSection('history');
    setError(null);
    setNotice(null);
    setCorrecting(null);
    setDraft({
      kind,
      date: todayLocalDate(),
      accountId: cashAccounts[0]?.id ?? '',
      categoryAccountId: kind === 'transfer'
        ? cashAccounts.find((account) => account.id !== cashAccounts[0]?.id)?.id ?? ''
        : snapshot.accounts.find((account) => account.kind === kind)?.id ?? '',
      amount: '',
      description: '',
      splits: null,
    });
  };

  useEffect(() => {
    if (!initialKind) return;
    beginNew(initialKind);
    onInitialKindHandled?.();
  }, [initialKind]);

  const beginCorrection = (transaction: TransactionRecord) => {
    if ((transaction.kind !== 'income' && transaction.kind !== 'expense' && transaction.kind !== 'transfer')
      || transaction.originalTransactionId || transaction.isGuaranteedPayment) return;
    setError(null);
    setNotice(null);
    setSection('history');
    setCorrecting(transaction);
    setDraft({
      kind: transaction.kind,
      date: transaction.date,
      accountId: transaction.accountId,
      categoryAccountId: transaction.categoryAccountId,
      amount: formatPositiveCents(transaction.amountCents < 0n ? -transaction.amountCents : transaction.amountCents),
      description: transaction.description,
      splits: (transaction.splitLines?.length ?? 0) > 1
        ? transaction.splitLines!.map((split) => ({
          id: Crypto.randomUUID(), categoryAccountId: split.categoryAccountId, amount: formatPositiveCents(split.amountCents),
        }))
        : null,
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const splitInputs = draft.splits?.map((split) => ({
        categoryAccountId: split.categoryAccountId,
        amountCents: parseUsd(split.amount),
      }));
      const amountCents = splitInputs
        ? splitInputs.reduce((sum, split) => sum + split.amountCents, 0n)
        : parseUsd(draft.amount);
      if (amountCents <= 0n) throw new Error('Enter an amount greater than zero.');
      if (!draft.accountId || (splitInputs ? splitInputs.some((split) => !split.categoryAccountId) : !draft.categoryAccountId)) {
        throw new Error(draft.kind === 'transfer'
          ? 'Create two bank or cash accounts and choose both accounts.'
          : 'Create a bank or cash account and choose a category first.');
      }
      if (correcting) {
        await correctCashTransaction({
          correctionId: Crypto.randomUUID(),
          originalTransactionId: correcting.id,
          reversalTransactionId: Crypto.randomUUID(),
          reversalJournalEntryId: Crypto.randomUUID(),
          replacement: {
            id: Crypto.randomUUID(),
            journalEntryId: Crypto.randomUUID(),
            businessId: snapshot.business!.id,
            date: draft.date,
            kind: draft.kind,
            accountId: draft.accountId,
            categoryAccountId: splitInputs?.[0]?.categoryAccountId ?? draft.categoryAccountId,
            amountCents,
            description: draft.description,
          },
          replacementSplits: splitInputs,
        });
        setNotice('The original remains in history. A reversal and replacement were posted.');
      } else if (draft.kind === 'transfer') {
        await recordTransfer({
          transactionId: Crypto.randomUUID(),
          journalEntryId: Crypto.randomUUID(),
          businessId: snapshot.business!.id,
          date: draft.date,
          sourceAccountId: draft.accountId,
          destinationAccountId: draft.categoryAccountId,
          amountCents,
          description: draft.description,
        });
        setNotice('Transfer posted between the selected cash or bank accounts; it does not change income or expenses.');
      } else {
        const common = {
          id: Crypto.randomUUID(), journalEntryId: Crypto.randomUUID(), businessId: snapshot.business!.id,
          date: draft.date, kind: draft.kind as 'income' | 'expense', accountId: draft.accountId,
          amountCents, description: draft.description,
        };
        if (splitInputs) {
          await recordSplitCashTransaction({ ...common, splits: splitInputs });
          setNotice('Split transaction posted to the encrypted journal with category allocations.');
        } else {
          await recordCashTransaction({ ...common, categoryAccountId: draft.categoryAccountId });
          setNotice('Transaction posted to the encrypted journal.');
        }
      }
      setDraft(null);
      setCorrecting(null);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The transaction could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    setError(null);
    setNotice(null);
    try {
      const file = new File(Paths.cache, `llc-transactions-${todayLocalDate()}.csv`);
      file.create({ intermediates: true, overwrite: true });
      await file.write(transactionsCsv(snapshot));
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export transaction CSV' });
      setNotice('CSV generated from the persisted transaction journal. Choose an explicit share destination to send a copy outside this device.');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The transaction CSV could not be exported.');
    }
  };

  const categoryOptions = categories.map((account) => ({ value: account.id, title: account.name }));
  const accountOptions = cashAccounts.map((account) => ({ value: account.id, title: account.name }));
  const filterAccountOptions = [{ value: 'all', title: 'All accounts' }, ...accountOptions];
  const filterCategoryOptions = [{ value: 'all', title: 'All categories' }, ...snapshot.accounts
    .filter((account) => account.kind === 'income' || account.kind === 'expense')
    .concat(cashAccounts)
    .map((account) => ({ value: account.id, title: account.name }))];
  const splitTotalCents = draft?.splits?.reduce((sum, split) => {
    try { return sum + parseUsd(split.amount); } catch { return sum; }
  }, 0n) ?? 0n;
  const selectedTransaction = snapshot.transactions.find((transaction) => transaction.id === selectedTransactionId) ?? null;
  const clearFilters = () => {
    setSearch('');
    setKindFilter('all');
    setAccountFilter('all');
    setCategoryFilter('all');
  };
  const hasFilters = search.length > 0 || kindFilter !== 'all' || accountFilter !== 'all' || categoryFilter !== 'all';

  return <Page>
    <Heading title="Transactions" subtitle="Income, expenses, and account transfers post balanced entries to the encrypted journal." />
    <Choice label="Transaction workspace" value={section} options={transactionWorkspaceSections} onChange={setSection} />
    <View style={uiStyles.row}>
      <Button title="＋ Income" onPress={() => beginNew('income')} />
      <Button title="＋ Expense" secondary onPress={() => beginNew('expense')} />
      <Button title="＋ Transfer" secondary onPress={() => beginNew('transfer')} />
    </View>
    {draft ? <Panel>
      <Text style={uiStyles.sectionTitle}>{correcting ? 'Reverse and replace transaction' : `Record ${draft.kind}`}</Text>
      {correcting ? <Text style={uiStyles.helper}>A reversal will be posted on the original date; the replacement uses the date below. The original entry remains visible for audit history.</Text> : null}
      <Choice label="Transaction type" value={draft.kind} options={[
        { value: 'income', title: 'Income' }, { value: 'expense', title: 'Operating expense' }, { value: 'transfer', title: 'Account transfer' },
      ]} onChange={(kind) => setDraft((current) => current ? {
        ...current,
        kind,
        splits: null,
        categoryAccountId: kind === 'transfer'
          ? cashAccounts.find((account) => account.id !== current.accountId)?.id ?? ''
          : snapshot.accounts.find((account) => account.kind === kind)?.id ?? '',
      } : current)} />
      <Choice label={draft.kind === 'transfer' ? 'From account' : 'Cash or bank account'} value={draft.accountId} options={accountOptions} onChange={(accountId) => setDraft((current) => current ? {
        ...current,
        accountId,
        categoryAccountId: current.kind === 'transfer' && current.categoryAccountId === accountId
          ? cashAccounts.find((account) => account.id !== accountId)?.id ?? ''
          : current.categoryAccountId,
      } : current)} />
      {!draft.splits ? <Choice label={draft.kind === 'transfer' ? 'To account' : 'Category'} value={draft.categoryAccountId} options={categoryOptions} onChange={(categoryAccountId) => setDraft((current) => current ? { ...current, categoryAccountId } : current)} /> : null}
      {draft.splits ? <View>
        <Text style={uiStyles.sectionTitle}>Category allocations · total ${formatPositiveCents(splitTotalCents)}</Text>
        {draft.splits.map((split, index) => <View key={split.id}>
          <Choice label={`Split ${index + 1} category`} value={split.categoryAccountId} options={categoryOptions} onChange={(categoryAccountId) => setDraft((current) => current ? {
            ...current,
            splits: current.splits?.map((item) => item.id === split.id ? { ...item, categoryAccountId } : item) ?? null,
          } : current)} />
          <Field label={`Split ${index + 1} amount in USD`} value={split.amount} onChangeText={(amount) => setDraft((current) => current ? {
            ...current,
            splits: current.splits?.map((item) => item.id === split.id ? { ...item, amount } : item) ?? null,
          } : current)} placeholder="0.00" keyboardType="decimal-pad" />
          {draft.splits!.length > 2 ? <Button title={`Remove split ${index + 1}`} secondary onPress={() => setDraft((current) => current ? {
            ...current, splits: current.splits?.filter((item) => item.id !== split.id) ?? null,
          } : current)} /> : null}
        </View>)}
        <Button title="Add category line" secondary onPress={() => setDraft((current) => {
          if (!current?.splits) return current;
          const used = new Set(current.splits.map((split) => split.categoryAccountId));
          const nextCategory = categories.find((account) => !used.has(account.id));
          return nextCategory ? {
            ...current,
            splits: [...current.splits, { id: Crypto.randomUUID(), categoryAccountId: nextCategory.id, amount: '' }],
          } : current;
        })} disabled={draft.splits.length >= categories.length} />
        <Text style={uiStyles.helper}>Split amounts must be positive and add up exactly to the transaction total.</Text>
      </View> : draft.kind !== 'transfer' && categories.length > 1 ? <Button title="Split across categories" secondary onPress={() => {
        const otherCategory = categories.find((account) => account.id !== draft.categoryAccountId);
        if (!otherCategory) return;
        setDraft((current) => current ? {
          ...current,
          splits: [
            { id: Crypto.randomUUID(), categoryAccountId: current.categoryAccountId, amount: '' },
            { id: Crypto.randomUUID(), categoryAccountId: otherCategory.id, amount: '' },
          ],
        } : current);
      }} /> : null}
      <View style={uiStyles.row}>
        <Field label="Transaction date" value={draft.date} onChangeText={(date) => setDraft((current) => current ? { ...current, date } : current)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        {!draft.splits ? <Field label="Amount in USD" value={draft.amount} onChangeText={(amount) => setDraft((current) => current ? { ...current, amount } : current)} placeholder="0.00" keyboardType="decimal-pad" /> : null}
      </View>
      <Field label="Description" value={draft.description} onChangeText={(description) => setDraft((current) => current ? { ...current, description } : current)} placeholder="What was this payment for?" />
      <FormError message={error} />
      <View style={uiStyles.row}>
        <Button title={correcting ? 'Post reversal and replacement' : 'Post transaction'} onPress={() => void save()} disabled={saving} />
        <Button title="Cancel" secondary onPress={() => { setDraft(null); setCorrecting(null); setError(null); }} disabled={saving} />
      </View>
    </Panel> : null}

    <View style={section === 'recurring' ? undefined : hiddenSection}>
      {snapshot.business ? <RecurringTransactionsSection snapshot={snapshot} onSaved={onSaved} /> : null}
    </View>
    <View style={section === 'import' ? undefined : hiddenSection}>
      {snapshot.business ? <TransactionCsvImportPanel snapshot={snapshot} onImported={onSaved} /> : null}
    </View>

    <View style={section === 'history' ? undefined : hiddenSection}>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Search and filter</Text>
      <Field label="Search description, category, account, or date" value={search} onChangeText={setSearch} placeholder="Search transactions" />
      <Choice label="Type" value={kindFilter} options={[
        { value: 'all', title: 'All activity' },
        { value: 'income', title: 'Income' },
        { value: 'expense', title: 'Expenses' },
        { value: 'transfer', title: 'Transfers' },
        { value: 'loan-advance', title: 'Loan advances' },
        { value: 'loan-repayment', title: 'Loan repayments' },
      ]} onChange={setKindFilter} />
      <Choice label="Account filter" value={accountFilter} options={filterAccountOptions} onChange={setAccountFilter} />
      <Choice label="Category filter" value={categoryFilter} options={filterCategoryOptions} onChange={setCategoryFilter} />
      {hasFilters ? <Button title="Clear filters" secondary onPress={clearFilters} /> : null}
      <Button title="Export all transactions as CSV" secondary onPress={() => void exportCsv()} disabled={snapshot.transactions.length === 0} />
      <FormError message={error && !draft ? error : null} />
      {notice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{notice}</Text> : null}
      <Text style={uiStyles.helper}>{filteredTransactions.length} of {snapshot.transactions.length} persisted records shown. CSV expands transfers into signed source and destination movements.</Text>
      {selectedTransaction ? <Panel style={detailPanel}>
        <View style={uiStyles.headingRow}>
          <Text accessibilityRole="header" style={uiStyles.sectionTitle}>Transaction details</Text>
          <Button title="Close details" secondary onPress={() => setSelectedTransactionId(null)} />
        </View>
        <Text style={uiStyles.rowTitle}>{selectedTransaction.description}</Text>
        <View style={uiStyles.row}>
          <StatusIndicator label={transactionRoleLabel(selectedTransaction)} tone={selectedTransaction.correctionRole === 'reversal' ? 'warning' : 'positive'} />
          <Money cents={selectedTransaction.amountCents} />
        </View>
        <Text style={uiStyles.rowDetail}>{selectedTransaction.date} · {selectedTransaction.category}</Text>
        <Text style={uiStyles.rowDetail}>Account: {selectedTransaction.accountName}</Text>
        {selectedTransaction.splitLines?.length ? <View>
          <Text style={uiStyles.rowTitle}>Category lines</Text>
          {selectedTransaction.splitLines.map((line) => <View key={line.categoryAccountId} style={uiStyles.reportRow}>
            <Text style={uiStyles.rowDetail}>{line.category}</Text><Money cents={line.amountCents} />
          </View>)}
        </View> : null}
        {selectedTransaction.originalTransactionId ? <Text style={uiStyles.helper}>Linked original transaction: {selectedTransaction.originalTransactionId}</Text> : null}
        {snapshot.transactions.filter((transaction) => transaction.originalTransactionId === selectedTransaction.id).map((linked) => <Text key={linked.id} style={uiStyles.helper}>
          Linked {transactionRoleLabel(linked).toLowerCase()}: {linked.date} · {linked.description} · {formatSignedAmount(linked.amountCents)}
        </Text>)}
        {(selectedTransaction.kind === 'income' || selectedTransaction.kind === 'expense' || selectedTransaction.kind === 'transfer')
          && !selectedTransaction.originalTransactionId && !selectedTransaction.isGuaranteedPayment
          ? <Button title="Reverse and replace" secondary onPress={() => beginCorrection(selectedTransaction)} />
          : null}
      </Panel> : null}
      {filteredTransactions.length ? filteredTransactions.map((transaction) => <TransactionRow
        key={transaction.id}
        transaction={transaction}
        onSelect={() => setSelectedTransactionId(transaction.id)}
        onCorrect={() => beginCorrection(transaction)}
      />) : <Text style={uiStyles.helper}>No transactions match these filters.</Text>}
    </Panel>
    </View>
  </Page>;
}

function TransactionRow({ transaction, onCorrect, onSelect }: { transaction: TransactionRecord; onCorrect: () => void; onSelect: () => void }) {
  const canCorrect = (transaction.kind === 'income' || transaction.kind === 'expense' || transaction.kind === 'transfer')
    && !transaction.originalTransactionId && !transaction.isGuaranteedPayment;
  const roleLabel = transactionRoleLabel(transaction);
  return <View style={uiStyles.transactionListItem}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${transaction.description}, ${roleLabel}`} onPress={onSelect} style={uiStyles.transactionSelect}>
      <View style={uiStyles.rowMain}>
        <Text style={uiStyles.rowTitle}>{transaction.description}</Text>
        <Text style={uiStyles.rowDetail}>{transaction.date} · {transaction.category} · {transaction.accountName}</Text>
        <StatusIndicator label={roleLabel} tone={transaction.correctionRole === 'reversal' ? 'warning' : 'neutral'} />
      </View>
      <Money cents={transaction.amountCents} />
    </Pressable>
    <View style={uiStyles.row}>
      <Button title="Details" secondary onPress={onSelect} />
      {canCorrect ? <Button title="Correct" secondary onPress={onCorrect} /> : null}
    </View>
  </View>;
}

function formatSignedAmount(cents: bigint): string {
  const amount = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '−' : '+'}$${formatPositiveCents(amount)}`;
}

function formatPositiveCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

const detailPanel = { borderColor: '#B7D6C4', backgroundColor: '#FCFEFC' };
const hiddenSection = { display: 'none' as const };
