import React from 'react';
import { Text, View } from 'react-native';
import type { BusinessRecord } from '../../../packages/storage-native/src/bookkeeping-store';
import { Button, Panel, uiStyles } from './ui';

export function WorkspacesSection({
  activeBusinessId,
  workspaces,
  onSelectBusiness,
  onAddBusiness,
}: {
  activeBusinessId: string;
  workspaces: readonly BusinessRecord[];
  onSelectBusiness: (businessId: string) => void;
  onAddBusiness: () => void;
}) {
  return <Panel>
    <Text style={uiStyles.sectionTitle}>LLC workspaces</Text>
    <Text style={uiStyles.rowDetail}>Each LLC has separate books in this device’s encrypted database. Switching workspaces does not move records.</Text>
    {workspaces.map((workspace) => <View key={workspace.id} style={uiStyles.rowItem}>
      <View style={uiStyles.rowMain}>
        <Text style={uiStyles.rowTitle}>{workspace.name}</Text>
        <Text style={uiStyles.rowDetail}>Formed in {workspace.formationState} · books begin {workspace.bookkeepingStartDate}</Text>
      </View>
      {workspace.id === activeBusinessId
        ? <Text accessibilityLabel={`${workspace.name} is the active workspace`} style={uiStyles.badge}>Active</Text>
        : <Button title={`Switch to ${workspace.name}`} secondary onPress={() => onSelectBusiness(workspace.id)} />}
    </View>)}
    <Button title="Add another LLC" onPress={onAddBusiness} />
  </Panel>;
}
