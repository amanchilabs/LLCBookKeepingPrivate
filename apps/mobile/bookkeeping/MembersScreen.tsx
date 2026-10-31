import * as Crypto from 'expo-crypto';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { parseOwnershipPercent, type MemberInterestInput } from '../../../packages/domain/src/bookkeeping';
import { replaceMembers } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Field, FormError, Heading, Page, Panel, todayLocalDate, uiStyles } from './ui';

interface MemberDraft {
  id: string;
  name: string;
  percent: string;
}

export function MembersScreen({ snapshot, onSaved }: { snapshot: BookkeepingSnapshot; onSaved: () => Promise<void> }) {
  const [members, setMembers] = useState<MemberDraft[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(todayLocalDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMembers(snapshot.members.map((member) => ({
      id: member.id,
      name: member.name,
      percent: fromBasisPoints(member.ownershipBasisPoints),
    })));
  }, [snapshot.members]);

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

function fromBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
