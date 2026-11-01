import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  completeBookkeepingReminder,
  deleteBookkeepingReminder,
  saveBookkeepingReminder,
} from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingReminderRecord } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Field, FormError, Panel, todayLocalDate, uiStyles } from './ui';

export function RemindersSection({
  businessId,
  reminders,
  onSaved,
}: {
  businessId: string;
  reminders: readonly BookkeepingReminderRecord[];
  onSaved: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(todayLocalDate());
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearDraft = () => {
    setEditingId(null);
    setTitle('');
    setDueDate(todayLocalDate());
    setDetails('');
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveBookkeepingReminder({
        id: editingId ?? Crypto.randomUUID(), businessId, dueDate, title, details,
      });
      setNotice(editingId ? 'Reminder updated.' : 'Reminder saved on this device.');
      clearDraft();
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The reminder could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const toggleComplete = async (reminder: BookkeepingReminderRecord) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await completeBookkeepingReminder(reminder.id, !reminder.isComplete);
      setNotice(reminder.isComplete ? 'Reminder reopened.' : 'Reminder marked complete.');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The reminder status could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (reminder: BookkeepingReminderRecord) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteBookkeepingReminder(reminder.id);
      if (editingId === reminder.id) clearDraft();
      setNotice('Reminder deleted.');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The reminder could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  return <Panel>
    <Text style={uiStyles.sectionTitle}>Reminders</Text>
    <Text style={uiStyles.rowDetail}>Reminders appear here and on the dashboard. They do not create system notifications or post financial activity.</Text>
    <Field label="Reminder title" value={title} onChangeText={setTitle} maxLength={120}
      placeholder="For example: Review monthly bank statement" />
    <Field label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD"
      keyboardType="numbers-and-punctuation" />
    <Field label="Details (optional)" value={details} onChangeText={setDetails} maxLength={500}
      placeholder="Add a note" multiline />
    <FormError message={error} />
    {notice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{notice}</Text> : null}
    <Button title={busy ? 'Saving…' : editingId ? 'Update reminder' : 'Save reminder'}
      onPress={() => void save()} disabled={busy || !title.trim()} />
    {editingId ? <Button title="Cancel reminder edit" secondary onPress={clearDraft} disabled={busy} /> : null}
    {reminders.length === 0 ? <Text style={uiStyles.helper}>No reminders yet.</Text> : reminders.map((reminder) => {
      const overdue = !reminder.isComplete && reminder.dueDate < todayLocalDate();
      return <View key={reminder.id} style={uiStyles.loanCard}>
        <View style={uiStyles.headingRow}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{reminder.title}</Text>
            <Text style={uiStyles.rowDetail}>{reminder.dueDate} · {reminder.isComplete ? 'Complete' : overdue ? 'Overdue' : 'Upcoming'}</Text>
          </View>
          <Text style={uiStyles.badge}>{reminder.isComplete ? 'Done' : overdue ? 'Overdue' : 'Open'}</Text>
        </View>
        {reminder.details ? <Text style={uiStyles.rowDetail}>{reminder.details}</Text> : null}
        <View style={uiStyles.row}>
          <Button title="Edit" secondary disabled={busy} onPress={() => {
            setEditingId(reminder.id);
            setTitle(reminder.title);
            setDueDate(reminder.dueDate);
            setDetails(reminder.details);
            setError(null);
            setNotice(null);
          }} />
          <Button title={reminder.isComplete ? 'Reopen' : 'Mark complete'} disabled={busy}
            onPress={() => void toggleComplete(reminder)} />
        </View>
        <Button title="Delete reminder" secondary disabled={busy} onPress={() => void remove(reminder)} />
      </View>;
    })}
  </Panel>;
}
