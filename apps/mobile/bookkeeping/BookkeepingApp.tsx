import React, { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { getBookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot } from '../../../packages/storage-native/src/bookkeeping-store';
import { AccountsScreen } from './AccountsScreen';
import { BusinessSetupScreen } from './BusinessSetupScreen';
import { DashboardScreen } from './DashboardScreen';
import { MembersScreen } from './MembersScreen';
import { LoansScreen } from './LoansScreen';
import { ReportsScreen } from './ReportsScreen';
import { SettingsScreen } from './SettingsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { contentTopInset } from './layout';
import { Button, Loading, palette } from './ui';

type BookkeepingTab = 'Dashboard' | 'Transactions' | 'Accounts' | 'Members' | 'Loans' | 'Reports' | 'Settings';
const tabs: BookkeepingTab[] = ['Dashboard', 'Transactions', 'Accounts', 'Members', 'Loans', 'Reports', 'Settings'];

function emptySnapshot(): BookkeepingSnapshot {
  return {
    business: null,
    members: [],
    memberHistory: [],
    accounts: [],
    transactions: [],
    capitalActivities: [],
    memberCapitalSummaries: [],
    guaranteedPaymentInstallments: [],
    guaranteedPaymentCashEvents: [],
    loanAgreements: [],
    loanActivities: [],
    accountReconciliations: [],
    accountReconciliationEvents: [],
    accountingPeriodEvents: [],
    closedThroughDate: null,
    recurringTransactions: [],
    cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n },
  };
}

export function BookkeepingApp({ SecurityProofScreen }: { SecurityProofScreen: ComponentType }) {
  const [snapshot, setSnapshot] = useState<BookkeepingSnapshot>(emptySnapshot);
  const [tab, setTab] = useState<BookkeepingTab>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSecurityProof, setShowSecurityProof] = useState(false);
  const rootStyle = [styles.root, { paddingTop: contentTopInset(Platform.OS, StatusBar.currentHeight) }];

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSnapshot(await getBookkeepingSnapshot());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Encrypted local storage could not be opened.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (showSecurityProof) {
    return <SafeAreaView style={rootStyle}>
      <View style={styles.proofBar}>
        <Text style={styles.brand}>Storage and recovery tools</Text>
        <Pressable accessibilityRole="button" onPress={() => { setShowSecurityProof(false); void refresh(); }} style={styles.backButton}>
          <Text style={styles.backButtonText}>Return to books</Text>
        </Pressable>
      </View>
      <SecurityProofScreen />
    </SafeAreaView>;
  }

  if (loading) return <SafeAreaView style={rootStyle}><Loading /></SafeAreaView>;

  if (loadError) {
    return <SafeAreaView style={rootStyle}>
      <View style={styles.lockedContent}>
        <Text style={styles.brand}>LLCBookKeepingPrivate</Text>
        <Text style={styles.lockedTitle}>Local books are unavailable</Text>
        <Text style={styles.lockedBody}>{loadError}</Text>
        <Text style={styles.lockedBody}>Existing encrypted files are preserved. Use the storage recovery tools to retry key access or restore a separately encrypted backup.</Text>
        <Button title="Open storage recovery tools" onPress={() => setShowSecurityProof(true)} />
        <Button title="Retry local storage" secondary onPress={() => void refresh()} />
      </View>
    </SafeAreaView>;
  }

  if (!snapshot.business) {
    return <SafeAreaView style={rootStyle}>
      <View style={styles.setupHeader}><Text style={styles.brand}>LLCBookKeepingPrivate</Text><Text style={styles.privacyLabel}>PRIVATE · ON DEVICE</Text></View>
      <BusinessSetupScreen onCreated={refresh} />
      <Pressable accessibilityRole="button" onPress={() => setShowSecurityProof(true)} style={styles.setupTools}>
        <Text style={styles.setupToolsText}>Storage and recovery tools</Text>
      </Pressable>
    </SafeAreaView>;
  }

  return <SafeAreaView style={rootStyle}>
    <View style={styles.appHeader}>
      <View style={styles.headerLine}>
        <View style={styles.headerMain}>
          <Text style={styles.brand}>LLCBookKeeping<Text style={styles.brandPrivate}>Private</Text></Text>
          <Text style={styles.business}>{snapshot.business.name}</Text>
        </View>
        <Text style={styles.privacyLabel}>ON DEVICE</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navigation}>
        {tabs.map((item) => <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === item }}
          key={item}
          onPress={() => setTab(item)}
          style={[styles.navButton, tab === item && styles.navButtonSelected]}
        ><Text style={[styles.navText, tab === item && styles.navTextSelected]}>{item}</Text></Pressable>)}
      </ScrollView>
    </View>
    <View style={styles.content}>
      {tab === 'Dashboard' ? <DashboardScreen snapshot={snapshot} onNavigate={setTab} /> : null}
      {tab === 'Transactions' ? <TransactionsScreen snapshot={snapshot} onSaved={refresh} /> : null}
      {tab === 'Accounts' ? <AccountsScreen snapshot={snapshot} onSaved={refresh} /> : null}
      {tab === 'Members' ? <MembersScreen snapshot={snapshot} onSaved={refresh} /> : null}
      {tab === 'Loans' ? <LoansScreen snapshot={snapshot} onSaved={refresh} /> : null}
      {tab === 'Reports' ? <ReportsScreen snapshot={snapshot} /> : null}
      {tab === 'Settings' ? <SettingsScreen business={snapshot.business} snapshot={snapshot}
        onSaved={refresh} onOpenSecurityProof={() => setShowSecurityProof(true)} /> : null}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  setupHeader: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: palette.border },
  headerLine: { minHeight: 64, paddingHorizontal: 18, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerMain: { flex: 1, gap: 2 },
  brand: { color: palette.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  brandPrivate: { color: '#52765e', fontWeight: '600' },
  business: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  privacyLabel: { color: '#55745d', backgroundColor: '#edf3eb', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  navigation: { gap: 4, paddingHorizontal: 12, paddingBottom: 8 },
  navButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8 },
  navButtonSelected: { backgroundColor: '#e8f0e7' },
  navText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  navTextSelected: { color: palette.green, fontWeight: '900' },
  content: { flex: 1 },
  setupTools: { alignItems: 'center', paddingVertical: 11 },
  setupToolsText: { color: palette.green, fontSize: 12, fontWeight: '700' },
  proofBar: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  backButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#edf3eb' },
  backButtonText: { color: palette.green, fontWeight: '800', fontSize: 12 },
  lockedContent: { flex: 1, justifyContent: 'center', padding: 22, gap: 14 },
  lockedTitle: { color: palette.ink, fontSize: 25, fontWeight: '900' },
  lockedBody: { color: palette.muted, fontSize: 14, lineHeight: 21 },
});
