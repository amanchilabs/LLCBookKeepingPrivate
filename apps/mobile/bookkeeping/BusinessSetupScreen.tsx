import * as Crypto from 'expo-crypto';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  parseOwnershipPercent,
  SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS,
  type BusinessSetupInput,
} from '../../../packages/domain/src/bookkeeping';
import { createBusiness } from '../../../packages/storage-native/src/bookkeeping-service';
import { Button, Field, FormError, Heading, Page, Panel, formatCents, uiStyles } from './ui';

interface SetupMemberDraft {
  name: string;
  percent: string;
}

export function BusinessSetupScreen({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [formationState, setFormationState] = useState('');
  const [formationDate, setFormationDate] = useState('');
  const [bookkeepingStartDate, setBookkeepingStartDate] = useState('');
  const [members, setMembers] = useState<SetupMemberDraft[]>([
    { name: '', percent: formatPercent(SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS[0]) },
    { name: '', percent: formatPercent(SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS[1]) },
    { name: '', percent: formatPercent(SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS[2]) },
    { name: '', percent: formatPercent(SUGGESTED_MEMBER_INTERESTS_BASIS_POINTS[3]) },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMember = (index: number, patch: Partial<SetupMemberDraft>) => {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch } : member));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const input: BusinessSetupInput = {
        id: Crypto.randomUUID(),
        name,
        formationState,
        formationDate,
        bookkeepingStartDate,
        ownershipConfirmed: true,
        members: members.map((member) => ({
          id: Crypto.randomUUID(),
          name: member.name,
          ownershipBasisPoints: parseOwnershipPercent(member.percent),
        })),
      };
      await createBusiness(input);
      await onCreated();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The LLC profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return <Page>
    <Heading title="Set up your LLC" subtitle="Your books stay in this app’s encrypted on-device database. You can change member interests later; changes are dated and retained." />
    <Panel>
      <Field label="LLC business name" value={name} onChangeText={setName} placeholder="Example: Northstar Studio LLC" autoCapitalize="words" returnKeyType="next" />
      <Field label="Formation state or territory" value={formationState} onChangeText={(value) => setFormationState(value.toUpperCase().slice(0, 2))} placeholder="Two-letter code, such as AZ" autoCapitalize="characters" maxLength={2} />
      <View style={uiStyles.row}>
        <Field label="Formation date" value={formationDate} onChangeText={setFormationDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <Field label="Bookkeeping start date" value={bookkeepingStartDate} onChangeText={setBookkeepingStartDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </View>
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Members and ownership interests</Text>
      <Text style={uiStyles.helper}>The suggested four-member split is 40% / 20% / 20% / 20%. Review or edit every value. Your tap on “Confirm and create LLC” confirms the percentages shown.</Text>
      {members.map((member, index) => <View key={index} style={uiStyles.row}>
        <Field label={`Member ${index + 1} name`} value={member.name} onChangeText={(value) => updateMember(index, { name: value })} placeholder="Full name" autoCapitalize="words" />
        <Field label={`Member ${index + 1} ownership percent`} value={member.percent} onChangeText={(value) => updateMember(index, { percent: value })} placeholder="20" keyboardType="decimal-pad" />
      </View>)}
      <FormError message={error} />
      <Button title="Confirm and create LLC" onPress={() => void save()} disabled={saving} />
      {saving && <Text style={uiStyles.helper}>Saving the profile and confirmed interests locally…</Text>}
    </Panel>
  </Page>;
}

function formatPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
