import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { parseUsd } from '../../../packages/domain/src/money';
import type { RecurringCadence } from '../../../packages/domain/src/recurring';
import {
  createRecurringTransaction,
  postRecurringTransaction,
  setRecurringTransactionActive,
  updateRecurringTransaction,
} from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, RecurringTransactionRecord } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Money, Panel, todayLocalDate, uiStyles } from './ui';

interface RecurringDraft {
  kind: 'income' | 'expense';
  accountId: string;
  categoryAccountId: string;
  amount: string;
  description: string;
  cadence: RecurringCadence;
  nextDate: string;
}

const cadenceOptions: { value: RecurringCadence; title: string }[] = [
  { value: 'weekly', title: 'Weekly' },
  { value: 'monthly', title: 'Monthly' },
  { value: 'quarterly', title: 'Quarterly' },
  { value: 'yearly', title: 'Yearly' },
];

export function RecurringTransactionsSection({
  snapshot,
  onSaved,
}: {
  snapshot: BookkeepingSnapshot;
  onSaved: () => Promise<void>;
}) {
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const [draft, setDraft] = useState<RecurringDraft | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const categories = snapshot.accounts.filter((account) => account.kind === (draft?.kind ?? 'expense'));
  const beginCreate = () => {
    setError(null);
    setNotice(null);
    setEditingTemplateId(null);
    setDraft({
      kind: 'expense',
      accountId: cashAccounts[0]?.id ?? '',
      categoryAccountId: snapshot.accounts.find((account) => account.kind === 'expense')?.id ?? '',
      amount: '',
      description: '',
      cadence: 'monthly',
      nextDate: todayLocalDate(),
    });
  };

  const beginEdit = (template: RecurringTransactionRecord) => {
    setError(null);
    setNotice(null);
    setEditingTemplateId(template.id);
    setDraft({
      kind: template.kind, accountId: template.accountId, categoryAccountId: template.categoryAccountId,
      amount: formatPositiveCents(template.amountCents), description: template.description,
      cadence: template.cadence, nextDate: template.nextDate,
    });
  };

  const save = async () => {
    if (!draft || !snapshot.business) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const amountCents = parseUsd(draft.amount);
      if (amountCents <= 0n) throw new Error('Enter an amount greater than zero.');
      if (!draft.accountId || !draft.categoryAccountId) throw new Error('Choose a cash or bank account and category.');
      const input = {
        id: Crypto.randomUUID(), businessId: snapshot.business.id, kind: draft.kind,
        accountId: draft.accountId, categoryAccountId: draft.categoryAccountId,
        amountCents, description: draft.description, cadence: draft.cadence, nextDate: draft.nextDate,
      };
      if (editingTemplateId) await updateRecurringTransaction({ ...input, id: editingTemplateId });
      else await createRecurringTransaction(input);
      setDraft(null);
      setEditingTemplateId(null);
      setNotice(editingTemplateId
        ? 'Schedule updated. Prior posted occurrences remain in journal history.'
        : 'Schedule saved. It will not post until you choose Post due occurrence.');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The recurring schedule could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const postNext = async (template: RecurringTransactionRecord) => {
    if (!snapshot.business) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await postRecurringTransaction({
        templateId: template.id, businessId: snapshot.business.id,
        occurrenceId: Crypto.randomUUID(), transactionId: Crypto.randomUUID(),
        journalEntryId: Crypto.randomUUID(), postingDate: todayLocalDate(),
      });
      setNotice(`${template.description} posted. The next scheduled date advanced only after the journal entry committed.`);
      await onSaved();
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'The recurring transaction could not be posted.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (template: RecurringTransactionRecord) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await setRecurringTransactionActive(template.id, !template.isActive);
      setNotice(template.isActive ? 'Schedule paused.' : 'Schedule resumed.');
      await onSaved();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'The recurring schedule could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const accountOptions = cashAccounts.map((account) => ({ value: account.id, title: account.name }));
  const categoryOptions = categories.map((account) => ({ value: account.id, title: account.name }));
  const today = todayLocalDate();

  return <Panel>
    <Text style={uiStyles.sectionTitle}>Recurring transactions</Text>
    <Text style={uiStyles.helper}>Schedules are reminders. Review each due occurrence and post it yourself; nothing posts automatically.</Text>
    {!draft ? <Button title="＋ Schedule income or expense" secondary onPress={beginCreate} /> : <View>
      <Text style={uiStyles.sectionTitle}>{editingTemplateId ? 'Edit recurring schedule' : 'New recurring schedule'}</Text>
      <Choice label="Transaction type" value={draft.kind} options={[
        { value: 'income', title: 'Income' }, { value: 'expense', title: 'Operating expense' },
      ]} onChange={(kind) => setDraft((current) => current ? {
        ...current,
        kind,
        categoryAccountId: snapshot.accounts.find((account) => account.kind === kind)?.id ?? '',
      } : current)} />
      <Choice label="Cash or bank account" value={draft.accountId} options={accountOptions} onChange={(accountId) => setDraft((current) => current ? { ...current, accountId } : current)} />
      <Choice label="Category" value={draft.categoryAccountId} options={categoryOptions} onChange={(categoryAccountId) => setDraft((current) => current ? { ...current, categoryAccountId } : current)} />
      <Choice label="Repeat" value={draft.cadence} options={cadenceOptions} onChange={(cadence) => setDraft((current) => current ? { ...current, cadence } : current)} />
      <Field label="Next scheduled date" value={draft.nextDate} onChangeText={(nextDate) => setDraft((current) => current ? { ...current, nextDate } : current)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      <Field label="Amount in USD" value={draft.amount} onChangeText={(amount) => setDraft((current) => current ? { ...current, amount } : current)} placeholder="0.00" keyboardType="decimal-pad" />
      <Field label="Description" value={draft.description} onChangeText={(description) => setDraft((current) => current ? { ...current, description } : current)} placeholder="For example, monthly office rent" />
      <FormError message={error} />
      <View style={uiStyles.row}>
        <Button title={editingTemplateId ? 'Save changes' : 'Save schedule'} onPress={() => void save()} disabled={saving} />
        <Button title="Cancel" secondary onPress={() => { setDraft(null); setEditingTemplateId(null); setError(null); }} disabled={saving} />
      </View>
    </View>}
    {snapshot.recurringTransactions.map((template) => {
      const due = template.nextDate <= today;
      return <View key={template.id} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{template.description}</Text>
          <Text style={uiStyles.rowDetail}>{template.kind === 'income' ? 'Income' : 'Operating expense'} · {template.cadence} · next {template.nextDate}</Text>
          <Text style={uiStyles.rowDetail}>{template.accountName} · {template.category}{template.lastPostedDate ? ` · last posted ${template.lastPostedDate}` : ''}</Text>
          <View style={uiStyles.row}>
            <Button title={template.isActive ? (due ? 'Post due occurrence' : 'Not due yet') : 'Schedule paused'} onPress={() => void postNext(template)} disabled={saving || !template.isActive || !due} />
            <Button title="Edit" secondary onPress={() => beginEdit(template)} disabled={saving} />
            <Button title={template.isActive ? 'Pause' : 'Resume'} secondary onPress={() => void toggleActive(template)} disabled={saving} />
          </View>
        </View>
        <Money cents={template.amountCents} />
      </View>;
    })}
    <FormError message={error && !draft ? error : null} />
    {notice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{notice}</Text> : null}
    {snapshot.recurringTransactions.length === 0 && !draft ? <Text style={uiStyles.helper}>No recurring schedules yet.</Text> : null}
  </Panel>;
}

function formatPositiveCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}
