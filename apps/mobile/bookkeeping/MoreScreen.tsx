import React from 'react';
import { Text, View } from 'react-native';
import type { AppDestination } from './navigation-model';
import { Button, Heading, Page, Panel, uiStyles } from './ui';

export function MoreScreen({ onNavigate }: { onNavigate: (destination: AppDestination) => void }) {
  return <Page>
    <Heading title="More" subtitle="Accounts, local settings, and recovery information for this LLC." />
    <Panel>
      <Text style={uiStyles.sectionTitle}>Accounts</Text>
      <Text style={uiStyles.rowDetail}>Create bank and cash accounts, review calculated balances, and reconcile statements manually.</Text>
      <Button title="Accounts and reconciliation" onPress={() => onNavigate('Accounts')} />
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Settings and privacy</Text>
      <Text style={uiStyles.rowDetail}>Manage local workspaces, reminders, bookkeeping periods, and data recovery tools.</Text>
      <Button title="Settings and privacy" secondary onPress={() => onNavigate('Settings')} />
    </Panel>
    <Panel>
      <Text style={uiStyles.sectionTitle}>Your data stays in your control</Text>
      <Text style={uiStyles.rowDetail}>There is no automatic cloud sync or bank connection. Export and backup actions are explicit and use the platform share or file flow.</Text>
    </Panel>
  </Page>;
}
