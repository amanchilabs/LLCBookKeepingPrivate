import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { parseUsd } from '../../../packages/domain/src/money';
import { createCashAccount } from '../../../packages/storage-native/src/bookkeeping-service';
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
  const cashAccounts = snapshot.accounts.filter(isCashAccount);

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
  </Page>;
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
