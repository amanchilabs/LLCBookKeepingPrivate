import React from 'react';
import { Text } from 'react-native';
import type { BusinessRecord } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Heading, Page, Panel, uiStyles } from './ui';

export function SettingsScreen({ business, onOpenSecurityProof }: { business: BusinessRecord; onOpenSecurityProof: () => void }) {
  return <Page>
    <Heading title="Settings" subtitle="This workspace stores the selected LLC’s books on this device." />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Business profile</Text>
      <Text style={uiStyles.rowTitle}>{business.name}</Text>
      <Text style={uiStyles.rowDetail}>Formed in {business.formationState} on {business.formationDate}</Text>
      <Text style={uiStyles.rowDetail}>Books begin {business.bookkeepingStartDate}</Text>
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
