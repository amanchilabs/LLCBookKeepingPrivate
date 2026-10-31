import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { parseUsd } from '../../../packages/domain/src/money';
import {
  correctCashTransaction,
  recordCashTransaction,
} from '../../../packages/storage-native/src/bookkeeping-service';
import {
  transactionsCsv,
  type AccountRecord,
  type BookkeepingSnapshot,
  type TransactionRecord,
} from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

type EntryKind = 'income' | 'expense';
type KindFilter = 'all' | EntryKind;
interface TransactionDraft {
  kind: EntryKind;
  date: string;
  accountId: string;
  categoryAccountId: string;
  amount: string;
  description: string;
}

export function TransactionsScreen({ snapshot, onSaved }: { snapshot: BookkeepingSnapshot; onSaved: () => Promise<void> }) {
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

  const categories = snapshot.accounts.filter((account) => account.kind === (draft?.kind ?? 'income'));
  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return snapshot.transactions.filter((transaction) => {
      const matchesKind = kindFilter === 'all' || transaction.kind === kindFilter;
      const matchesAccount = accountFilter === 'all' || transaction.accountId === accountFilter;
      const matchesCategory = categoryFilter === 'all' || transaction.categoryAccountId === categoryFilter;
      const matchesSearch = !query || [transaction.description, transaction.category, transaction.accountName, transaction.date]
        .some((value) => value.toLowerCase().includes(query));
      return matchesKind && matchesAccount && matchesCategory && matchesSearch;
    });
  }, [snapshot.transactions, kindFilter, accountFilter, categoryFilter, search]);

  const beginNew = (kind: EntryKind = 'income') => {
    setError(null);
    setNotice(null);
    setCorrecting(null);
    setDraft({
      kind,
      date: todayLocalDate(),
      accountId: cashAccounts[0]?.id ?? '',
      categoryAccountId: snapshot.accounts.find((account) => account.kind === kind)?.id ?? '',
      amount: '',
      description: '',
    });
  };

  const beginCorrection = (transaction: TransactionRecord) => {
    if ((transaction.kind !== 'income' && transaction.kind !== 'expense') || transaction.originalTransactionId) return;
    setError(null);
    setNotice(null);
    setCorrecting(transaction);
    setDraft({
      kind: transaction.kind,
      date: transaction.date,
      accountId: transaction.accountId,
      categoryAccountId: transaction.categoryAccountId,
      amount: formatPositiveCents(transaction.amountCents < 0n ? -transaction.amountCents : transaction.amountCents),
      description: transaction.description,
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const amountCents = parseUsd(draft.amount);
      if (amountCents <= 0n) throw new Error('Enter an amount greater than zero.');
      if (!draft.accountId || !draft.categoryAccountId) throw new Error('Create a bank or cash account and choose a category first.');
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
            categoryAccountId: draft.categoryAccountId,
            amountCents,
            description: draft.description,
          },
        });
        setNotice('The original remains in history. A reversal and replacement were posted.');
      } else {
        await recordCashTransaction({
          id: Crypto.randomUUID(),
          journalEntryId: Crypto.randomUUID(),
          businessId: snapshot.business!.id,
          date: draft.date,
          kind: draft.kind,
          accountId: draft.accountId,
          categoryAccountId: draft.categoryAccountId,
          amountCents,
          description: draft.description,
        });
        setNotice('Transaction posted to the encrypted journal.');
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
    .map((account) => ({ value: account.id, title: account.name }))];

  return <Page>
    <Heading title="Transactions" subtitle="Income and operating expenses post balanced cash-basis journal entries in the encrypted database." />
    <View style={uiStyles.row}>
      <Button title="＋ Income" onPress={() => beginNew('income')} />
      <Button title="＋ Expense" secondary onPress={() => beginNew('expense')} />
    </View>
    {draft ? <Panel>
      <Text style={uiStyles.sectionTitle}>{correcting ? 'Reverse and replace transaction' : `Record ${draft.kind}`}</Text>
      {correcting ? <Text style={uiStyles.helper}>A reversal will be posted on the original date; the replacement uses the date below. The original entry remains visible for audit history.</Text> : null}
      <Choice label="Transaction type" value={draft.kind} options={[{ value: 'income', title: 'Income' }, { value: 'expense', title: 'Operating expense' }]} onChange={(kind) => setDraft((current) => current ? {
        ...current,
        kind,
        categoryAccountId: snapshot.accounts.find((account) => account.kind === kind)?.id ?? '',
      } : current)} />
      <Choice label="Cash or bank account" value={draft.accountId} options={accountOptions} onChange={(accountId) => setDraft((current) => current ? { ...current, accountId } : current)} />
      <Choice label="Category" value={draft.categoryAccountId} options={categoryOptions} onChange={(categoryAccountId) => setDraft((current) => current ? { ...current, categoryAccountId } : current)} />
      <View style={uiStyles.row}>
        <Field label="Transaction date" value={draft.date} onChangeText={(date) => setDraft((current) => current ? { ...current, date } : current)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Amount in USD" value={draft.amount} onChangeText={(amount) => setDraft((current) => current ? { ...current, amount } : current)} placeholder="0.00" keyboardType="decimal-pad" />
      </View>
      <Field label="Description" value={draft.description} onChangeText={(description) => setDraft((current) => current ? { ...current, description } : current)} placeholder="What was this payment for?" />
      <FormError message={error} />
      <View style={uiStyles.row}>
        <Button title={correcting ? 'Post reversal and replacement' : 'Post transaction'} onPress={() => void save()} disabled={saving} />
        <Button title="Cancel" secondary onPress={() => { setDraft(null); setCorrecting(null); setError(null); }} disabled={saving} />
      </View>
    </Panel> : null}

    <Panel>
      <Text style={uiStyles.sectionTitle}>Search and filter</Text>
      <Field label="Search description, category, account, or date" value={search} onChangeText={setSearch} placeholder="Search transactions" />
      <Choice label="Type" value={kindFilter} options={[
        { value: 'all', title: 'All activity' },
        { value: 'income', title: 'Income' },
        { value: 'expense', title: 'Expenses' },
      ]} onChange={setKindFilter} />
      <Choice label="Account filter" value={accountFilter} options={filterAccountOptions} onChange={setAccountFilter} />
      <Choice label="Category filter" value={categoryFilter} options={filterCategoryOptions} onChange={setCategoryFilter} />
      <Button title="Export all transactions as CSV" secondary onPress={() => void exportCsv()} disabled={snapshot.transactions.length === 0} />
      <FormError message={error && !draft ? error : null} />
      {notice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{notice}</Text> : null}
      <Text style={uiStyles.helper}>{filteredTransactions.length} of {snapshot.transactions.length} persisted records shown. CSV totals use signed cash movements, including opening balances and reversals.</Text>
      {filteredTransactions.length ? filteredTransactions.map((transaction) => <TransactionRow
        key={transaction.id}
        transaction={transaction}
        onCorrect={() => beginCorrection(transaction)}
      />) : <Text style={uiStyles.helper}>No transactions match these filters.</Text>}
    </Panel>
  </Page>;
}

function TransactionRow({ transaction, onCorrect }: { transaction: TransactionRecord; onCorrect: () => void }) {
  const canCorrect = (transaction.kind === 'income' || transaction.kind === 'expense') && !transaction.originalTransactionId;
  const roleLabel = transaction.correctionRole === 'reversal'
    ? 'Reversal'
    : transaction.correctionRole === 'replacement'
      ? 'Replacement'
      : transaction.originalTransactionId
        ? 'Original · corrected'
        : transaction.kind === 'opening-balance'
          ? 'Opening balance'
          : transaction.kind === 'income' ? 'Income' : 'Operating expense';
  return <View style={uiStyles.rowItem}>
    <View style={uiStyles.rowMain}>
      <Text style={uiStyles.rowTitle}>{transaction.description}</Text>
      <Text style={uiStyles.rowDetail}>{transaction.date} · {transaction.category} · {transaction.accountName} · {roleLabel}</Text>
      {canCorrect ? <Button title="Correct" secondary onPress={onCorrect} /> : null}
    </View>
    <Money cents={transaction.amountCents} />
  </View>;
}

function formatPositiveCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}
