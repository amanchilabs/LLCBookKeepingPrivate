import * as Crypto from 'expo-crypto';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { parseOwnershipPercent, type MemberInterestInput } from '../../../packages/domain/src/bookkeeping';
import { formatUsd, parseUsd } from '../../../packages/domain/src/money';
import { recordMemberCapitalActivity, replaceMembers } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Choice, Field, FormError, Heading, Money, Page, Panel, todayLocalDate, uiStyles } from './ui';

interface MemberDraft {
  id: string;
  name: string;
  percent: string;
}

type CapitalActivityKind = 'cash-contribution' | 'property-contribution' | 'distribution';

export function MembersScreen({ snapshot, onSaved }: { snapshot: BookkeepingSnapshot; onSaved: () => Promise<void> }) {
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(todayLocalDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cashAccounts = snapshot.accounts.filter((account) => account.kind === 'bank' || account.kind === 'cash');
  const [capitalKind, setCapitalKind] = useState<CapitalActivityKind>('cash-contribution');
  const [capitalMemberId, setCapitalMemberId] = useState(snapshot.members[0]?.id ?? '');
  const [capitalAccountId, setCapitalAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [capitalDate, setCapitalDate] = useState(todayLocalDate());
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalDescription, setCapitalDescription] = useState('');
  const [propertyDescription, setPropertyDescription] = useState('');
  const [capitalSaving, setCapitalSaving] = useState(false);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [capitalNotice, setCapitalNotice] = useState<string | null>(null);

  useEffect(() => {
    setMembers(snapshot.members.map((member) => ({
      id: member.id,
      name: member.name,
      percent: fromBasisPoints(member.ownershipBasisPoints),
    })));
  }, [snapshot.members]);

  useEffect(() => {
    if (!snapshot.members.some((member) => member.id === capitalMemberId)) {
      setCapitalMemberId(snapshot.members[0]?.id ?? '');
    }
  }, [snapshot.members, capitalMemberId]);

  useEffect(() => {
    if (!cashAccounts.some((account) => account.id === capitalAccountId)) {
      setCapitalAccountId(cashAccounts[0]?.id ?? '');
    }
  }, [snapshot.accounts, capitalAccountId]);

  const update = (index: number, patch: Partial<MemberDraft>) => {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const values: MemberInterestInput[] = members.map((member) => ({
        id: member.id,
        name: member.name,
        ownershipBasisPoints: parseOwnershipPercent(member.percent),
      }));
      await replaceMembers({
        businessId: snapshot.business!.id,
        effectiveDate,
        ownershipConfirmed: true,
        members: values,
      });
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Member changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const saveCapitalActivity = async () => {
    setCapitalSaving(true);
    setCapitalError(null);
    setCapitalNotice(null);
    try {
      const amountCents = parseUsd(capitalAmount);
      if (amountCents <= 0n) throw new Error('Enter an amount greater than zero.');
      if (!capitalMemberId) throw new Error('Choose a member for this capital activity.');
      if (capitalKind !== 'property-contribution' && !capitalAccountId) {
        throw new Error('Create a bank or cash account before recording this activity.');
      }
      await recordMemberCapitalActivity({
        id: Crypto.randomUUID(),
        journalEntryId: Crypto.randomUUID(),
        businessId: snapshot.business!.id,
        memberId: capitalMemberId,
        date: capitalDate,
        kind: capitalKind,
        amountCents,
        description: capitalDescription,
        cashAccountId: capitalKind === 'property-contribution' ? undefined : capitalAccountId,
        propertyDescription: capitalKind === 'property-contribution' ? propertyDescription : undefined,
      });
      setCapitalAmount('');
      setCapitalDescription('');
      setPropertyDescription('');
      setCapitalNotice('Capital activity posted to the member ledger and balanced journal.');
      await onSaved();
    } catch (saveError) {
      setCapitalError(saveError instanceof Error ? saveError.message : 'Capital activity could not be posted.');
    } finally {
      setCapitalSaving(false);
    }
  };

  return <Page>
    <Heading title="Members" subtitle="Edit member names and ownership interests. Every ownership change keeps its prior effective dates in the local history." />
    <Panel>
      {members.map((member, index) => <View key={member.id} style={uiStyles.row}>
        <Field label={`Member ${index + 1} name`} value={member.name} onChangeText={(value) => update(index, { name: value })} autoCapitalize="words" />
        <Field label={`Member ${index + 1} ownership percent`} value={member.percent} onChangeText={(value) => update(index, { percent: value })} keyboardType="decimal-pad" />
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${member.name || `member ${index + 1}`}`} onPress={() => setMembers((current) => current.filter((item) => item.id !== member.id))} style={uiStyles.remove}>
          <Text style={uiStyles.removeText}>×</Text>
        </Pressable>
      </View>)}
      <Button title="Add member" secondary onPress={() => setMembers((current) => [...current, { id: Crypto.randomUUID(), name: '', percent: '0' }])} />
      <Field label="Change effective date" value={effectiveDate} onChangeText={setEffectiveDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      <Text style={uiStyles.helper}>Active member interests must total exactly 100%. Saving confirms the percentages above. Effective dates cannot rewrite an existing ownership period.</Text>
      <FormError message={error} />
      <Button title="Confirm and save member changes" onPress={() => void save()} disabled={saving} />
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Record member capital activity</Text>
      <Choice label="Capital activity type" value={capitalKind} options={[
        { value: 'cash-contribution', title: 'Cash contribution' },
        { value: 'property-contribution', title: 'Property contribution' },
        { value: 'distribution', title: 'Distribution' },
      ]} onChange={setCapitalKind} />
      <Choice label="Member receiving capital activity" value={capitalMemberId} options={snapshot.members.map((member) => ({ value: member.id, title: member.name }))} onChange={setCapitalMemberId} />
      {capitalKind !== 'property-contribution' ? <Choice label="Cash or bank account for capital activity" value={capitalAccountId} options={cashAccounts.map((account) => ({ value: account.id, title: account.name }))} onChange={setCapitalAccountId} /> : null}
      <View style={uiStyles.row}>
        <Field label="Capital activity date" value={capitalDate} onChangeText={setCapitalDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Capital activity amount in USD" value={capitalAmount} onChangeText={setCapitalAmount} placeholder="0.00" keyboardType="decimal-pad" />
      </View>
      {capitalKind === 'property-contribution' ? <>
        <Field label="Property description — CPA review required" value={propertyDescription} onChangeText={setPropertyDescription} placeholder="Describe contributed property" />
        <Text style={uiStyles.helper}>The amount is recorded as book value only. Confirm property description and valuation with a CPA; tax basis and outside basis are not calculated.</Text>
      </> : null}
      <Field label="Capital activity description" value={capitalDescription} onChangeText={setCapitalDescription} placeholder="Describe the contribution or distribution" />
      {capitalKind !== 'property-contribution' && cashAccounts.length === 0
        ? <Text style={uiStyles.helper}>Create a bank or cash account before recording a cash contribution or distribution.</Text>
        : null}
      <FormError message={capitalError} />
      {capitalNotice ? <Text accessibilityLiveRegion="polite" style={uiStyles.helper}>{capitalNotice}</Text> : null}
      <Button title={capitalSaving ? 'Posting…' : 'Post capital activity'} onPress={() => void saveCapitalActivity()} disabled={capitalSaving || snapshot.members.length === 0} />
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Member capital ledgers</Text>
      <Text style={uiStyles.helper}>Book capital activity only: contributions less distributions. This is not tax-basis capital or outside basis.</Text>
      {snapshot.memberCapitalSummaries.map((summary) => <View key={summary.memberId} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{summary.memberName}</Text>
          <Text style={uiStyles.rowDetail}>Cash ${formatUsd(summary.cashContributionsCents)} · Property ${formatUsd(summary.propertyContributionsCents)} · Distributions ${formatUsd(summary.distributionsCents)}</Text>
        </View>
        <Money cents={summary.bookCapitalActivityCents} />
      </View>)}
      <Text style={uiStyles.sectionTitle}>Dated capital activity</Text>
      {snapshot.capitalActivities.length ? snapshot.capitalActivities.map((activity) => <View key={activity.id} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{activity.memberName} · {capitalActivityLabel(activity.kind)}</Text>
          <Text style={uiStyles.rowDetail}>{activity.date} · {activity.description}{activity.cashAccountName ? ` · ${activity.cashAccountName}` : ''}</Text>
          {activity.requiresCpaReview ? <Text style={uiStyles.helper}>CPA review required · book value only · {activity.propertyDescription}</Text> : null}
        </View>
        <Money cents={activity.kind === 'distribution' ? -activity.amountCents : activity.amountCents} />
      </View>) : <Text style={uiStyles.helper}>No capital activity recorded yet.</Text>}
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Ownership history</Text>
      {snapshot.memberHistory.map((record) => <View key={record.id + record.effectiveFrom} style={uiStyles.rowItem}>
        <View style={uiStyles.rowMain}>
          <Text style={uiStyles.rowTitle}>{record.name}</Text>
          <Text style={uiStyles.rowDetail}>{record.effectiveFrom}{record.effectiveTo ? ` through ${record.effectiveTo}` : ' onward'}</Text>
        </View>
        <Text style={uiStyles.badge}>{fromBasisPoints(record.ownershipBasisPoints)}%</Text>
      </View>)}
    </Panel>
  </Page>;
}

function capitalActivityLabel(kind: CapitalActivityKind): string {
  if (kind === 'cash-contribution') return 'Cash contribution';
  if (kind === 'property-contribution') return 'Property contribution';
  return 'Distribution';
}

function fromBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
