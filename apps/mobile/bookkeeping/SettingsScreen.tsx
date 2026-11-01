import * as Crypto from 'expo-crypto';
import React from 'react';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { closeAccountingPeriod, reopenAccountingPeriod } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, BusinessRecord } from '../../../packages/storage-native/src/bookkeeping-store';
import { RemindersSection } from './RemindersSection';
import { WorkspacesSection } from './WorkspacesSection';
import { Button, Field, FormError, Heading, Page, Panel, todayLocalDate, uiStyles } from './ui';

export function SettingsScreen({
  business, snapshot, workspaces, onSelectBusiness, onAddBusiness, onSaved, onOpenSecurityProof,
}: {
  business: BusinessRecord;
  snapshot: BookkeepingSnapshot;
  workspaces: readonly BusinessRecord[];
  onSelectBusiness: (businessId: string) => void;
  onAddBusiness: () => void;
  onSaved: () => Promise<void>;
  onOpenSecurityProof: () => void;
}) {
  const [throughDate, setThroughDate] = useState(todayLocalDate());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const closePeriod = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await closeAccountingPeriod({
        id: Crypto.randomUUID(), businessId: business.id, throughDate, reason,
      });
      setReason('');
      setNotice(`Books are now closed through ${throughDate}.`);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The period could not be closed.');
    } finally {
      setBusy(false);
    }
  };
  const reopenLatestPeriod = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await reopenAccountingPeriod({ id: Crypto.randomUUID(), businessId: business.id, reason });
      setReason('');
      setNotice('The latest period was reopened. Earlier closed periods remain locked.');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The period could not be reopened.');
    } finally {
      setBusy(false);
    }
  };
  return <Page>
    <Heading title="Settings" subtitle="This workspace stores the selected LLC’s books on this device." />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Business profile</Text>
      <Text style={uiStyles.rowTitle}>{business.name}</Text>
      <Text style={uiStyles.rowDetail}>Formed in {business.formationState} on {business.formationDate}</Text>
      <Text style={uiStyles.rowDetail}>Books begin {business.bookkeepingStartDate}</Text>
    </Panel>
    {snapshot.members.length === 1 ? <Panel>
      <Text style={uiStyles.sectionTitle}>Single-member bookkeeping policy</Text>
      <Text style={uiStyles.rowDetail}>Owner contributions and distributions are tracked as equity, not income or operating expenses. Guaranteed-payment obligations and payments are disabled. Owner labor and tax classification require CPA review; the app does not infer tax treatment.</Text>
    </Panel> : null}
    <WorkspacesSection activeBusinessId={business.id} workspaces={workspaces}
      onSelectBusiness={onSelectBusiness} onAddBusiness={onAddBusiness} />
    <RemindersSection businessId={business.id} reminders={snapshot.reminders} onSaved={onSaved} />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Bookkeeping periods</Text>
      <Text style={uiStyles.rowDetail}>Closing locks new journal postings dated on or before the selected date. It does not create closing entries or change existing balances. Reopening records an audit event and unlocks the latest closed interval.</Text>
      <Text style={uiStyles.rowTitle}>{snapshot.closedThroughDate
        ? `Currently closed through ${snapshot.closedThroughDate}`
        : 'No periods are closed'}</Text>
      <View style={uiStyles.row}>
        <Field label="Close books through" value={throughDate} onChangeText={setThroughDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </View>
      <Field label="Reason for close or reopen" value={reason} onChangeText={setReason} placeholder="For example: monthly review complete" />
      <FormError message={error} />
      {notice ? <Text style={uiStyles.helper}>{notice}</Text> : null}
      <Button title={busy ? 'Saving…' : 'Close books through date'} onPress={() => void closePeriod()} disabled={busy || !reason.trim()} />
      {snapshot.closedThroughDate ? <Button title={busy ? 'Saving…' : 'Reopen latest period'} secondary
        onPress={() => void reopenLatestPeriod()} disabled={busy || !reason.trim()} /> : null}
      {snapshot.accountingPeriodEvents.length ? <View>
        <Text style={uiStyles.rowTitle}>Period audit history</Text>
        {snapshot.accountingPeriodEvents.map((event) => <View key={event.id} style={uiStyles.rowItem}>
          <View style={uiStyles.rowMain}>
            <Text style={uiStyles.rowTitle}>{event.action === 'close' ? 'Closed' : 'Reopened'} · {event.periodStartDate} through {event.throughDate}</Text>
            <Text style={uiStyles.rowDetail}>{event.reason}{event.action === 'close' && event.isActive ? ' · active lock' : ''}</Text>
          </View>
        </View>)}
      </View> : <Text style={uiStyles.helper}>Close events and reopen reasons will be retained here.</Text>}
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Privacy</Text>
      <Text style={uiStyles.rowDetail}>Bookkeeping data remains in the encrypted on-device database. The mobile app has no bookkeeping backend, automatic cloud sync, bank connection, analytics, or advertising.</Text>
      <Text style={uiStyles.helper}>CSV export and encrypted backup leave this device only after you explicitly choose an export or share destination.</Text>
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Storage and backup proof</Text>
      <Text style={uiStyles.rowDetail}>The native SQLCipher, platform key-storage, recovery, and encrypted backup proof tools remain available here.</Text>
      <Button title="Open native security and recovery tools" secondary onPress={onOpenSecurityProof} />
    </Panel>
  </Page>;
}
