import React, { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { getBookkeepingSnapshot, getBusinessProfiles, selectBusiness } from '../../../packages/storage-native/src/bookkeeping-service';
import type { BookkeepingSnapshot, BusinessRecord } from '../../../packages/storage-native/src/bookkeeping-store';
import { AccountsScreen } from './AccountsScreen';
import { BusinessSetupScreen } from './BusinessSetupScreen';
import { DashboardScreen } from './DashboardScreen';
import { MembersScreen } from './MembersScreen';
import { LoansScreen } from './LoansScreen';
import { ReportsScreen } from './ReportsScreen';
import { SearchScreen } from './SearchScreen';
import { SettingsScreen } from './SettingsScreen';
import { TransactionsScreen } from './TransactionsScreen';
import { MoreScreen } from './MoreScreen';
import { contentTopInset } from './layout';
import { BottomTabBar, Button, Loading, palette } from './ui';
import { primaryTabForDestination, primaryTabs, type AppDestination, type MoreSection, type PrimaryTab } from './navigation-model';

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
    reminders: [],
    cashBasis: { incomeCents: 0n, expenseCents: 0n, netIncomeCents: 0n },
  };
}

export function BookkeepingApp({ SecurityProofScreen }: { SecurityProofScreen: ComponentType }) {
  const [snapshot, setSnapshot] = useState<BookkeepingSnapshot>(emptySnapshot);
  const [tab, setTab] = useState<PrimaryTab>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSecurityProof, setShowSecurityProof] = useState(false);
  const [showBusinessSetup, setShowBusinessSetup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [moreSection, setMoreSection] = useState<MoreSection | null>(null);
  const [showLoans, setShowLoans] = useState(false);
  const [loanMemberId, setLoanMemberId] = useState<string | undefined>();
  const [workspaces, setWorkspaces] = useState<BusinessRecord[]>([]);
  const rootStyle = [styles.root, { paddingTop: contentTopInset(Platform.OS, StatusBar.currentHeight) }];

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const nextSnapshot = await getBookkeepingSnapshot();
      const nextWorkspaces = await getBusinessProfiles();
      setSnapshot(nextSnapshot);
      setWorkspaces(nextWorkspaces);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Encrypted local storage could not be opened.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createWorkspace = async () => {
    setShowBusinessSetup(false);
    setTab('Dashboard');
    setMoreSection(null);
    setShowSearch(false);
    await refresh();
  };

  const navigateTo = (destination: AppDestination) => {
    if (destination === 'Search') {
      setShowSearch(true);
      return;
    }
    setShowSearch(false);
    setLoanMemberId(undefined);
    setShowLoans(destination === 'Loans');
    if (destination === 'Accounts' || destination === 'Settings') {
      setTab('More');
      setMoreSection(destination);
    } else if (destination === 'Loans') {
      setTab('Members');
      setMoreSection(null);
    } else {
      setTab(primaryTabForDestination(destination));
      setMoreSection(null);
    }
  };

  const openMemberLoans = (memberId: string) => {
    setTab('Members');
    setMoreSection(null);
    setShowSearch(false);
    setShowLoans(true);
    setLoanMemberId(memberId);
  };

  const selectTab = (next: PrimaryTab) => {
    setTab(next);
    setShowSearch(false);
    setShowLoans(false);
    setLoanMemberId(undefined);
    setMoreSection(null);
  };

  const changeWorkspace = async (businessId: string) => {
    try {
      await selectBusiness(businessId);
      setTab('Dashboard');
      await refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The selected LLC could not be opened.');
    }
  };

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
        <Text style={styles.lockedBody}>The app could not open the local books. Retry access or open the storage recovery tools to review available recovery options.</Text>
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

  if (showBusinessSetup) {
    return <SafeAreaView style={rootStyle}>
      <View style={styles.setupHeader}>
        <Text style={styles.brand}>Add an LLC workspace</Text>
        <Pressable accessibilityRole="button" onPress={() => setShowBusinessSetup(false)} style={styles.backButton}>
          <Text style={styles.backButtonText}>Cancel</Text>
        </Pressable>
      </View>
      <BusinessSetupScreen onCreated={createWorkspace} />
    </SafeAreaView>;
  }

  return <SafeAreaView style={rootStyle}>
    <View style={styles.appHeader}>
      <View style={styles.headerLine}>
        <View style={styles.headerMain}>
          <Text style={styles.brand}>LLCBookKeeping<Text style={styles.brandPrivate}>Private</Text></Text>
          <Text style={styles.business}>{snapshot.business.name}</Text>
        </View>
        <Button title={showSearch ? 'Close search' : 'Search'} secondary onPress={() => setShowSearch((current) => !current)} />
      </View>
    </View>
    <View style={styles.content}>
      {showSearch ? <>
        <RouteBack title="Search" onBack={() => setShowSearch(false)} />
        <SearchScreen snapshot={snapshot} onNavigate={navigateTo} />
      </> : null}
      {!showSearch && tab === 'Dashboard' ? <DashboardScreen snapshot={snapshot} onNavigate={navigateTo} /> : null}
      {!showSearch && tab === 'Transactions' ? <TransactionsScreen snapshot={snapshot} onSaved={refresh} /> : null}
      {!showSearch && tab === 'Members' && !showLoans ? <MembersScreen snapshot={snapshot} onSaved={refresh} onOpenMemberLoans={openMemberLoans} /> : null}
      {!showSearch && tab === 'Members' && showLoans ? <>
        <RouteBack title="Members" onBack={() => { setShowLoans(false); setLoanMemberId(undefined); }} />
        <LoansScreen snapshot={snapshot} onSaved={refresh} initialMemberId={loanMemberId} />
      </> : null}
      {!showSearch && tab === 'Reports' ? <ReportsScreen snapshot={snapshot} /> : null}
      {!showSearch && tab === 'More' && moreSection === null ? <MoreScreen onNavigate={navigateTo} /> : null}
      {!showSearch && tab === 'More' && moreSection === 'Accounts' ? <>
        <RouteBack title="More" onBack={() => setMoreSection(null)} />
        <AccountsScreen snapshot={snapshot} onSaved={refresh} />
      </> : null}
      {!showSearch && tab === 'More' && moreSection === 'Settings' ? <>
        <RouteBack title="More" onBack={() => setMoreSection(null)} />
        <SettingsScreen business={snapshot.business} snapshot={snapshot}
        workspaces={workspaces} onSelectBusiness={changeWorkspace} onAddBusiness={() => setShowBusinessSetup(true)}
        onSaved={refresh} onOpenSecurityProof={() => setShowSecurityProof(true)} />
      </> : null}
    </View>
    <BottomTabBar items={primaryTabs} selected={tab} onSelect={selectTab} />
  </SafeAreaView>;
}

function RouteBack({ title, onBack }: { title: string; onBack: () => void }) {
  return <View style={styles.routeBack}>
    <Button title={`‹ ${title}`} secondary onPress={onBack} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  setupHeader: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: palette.border },
  headerLine: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerMain: { flex: 1, gap: 2 },
  brand: { color: palette.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  brandPrivate: { color: '#52765e', fontWeight: '600' },
  business: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  privacyLabel: { color: '#07583F', backgroundColor: '#E7F3EC', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  routeBack: { alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 10 },
  setupTools: { alignItems: 'center', paddingVertical: 11 },
  setupToolsText: { color: palette.green, fontSize: 12, fontWeight: '700' },
  proofBar: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  backButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#edf3eb' },
  backButtonText: { color: palette.green, fontWeight: '800', fontSize: 12 },
  lockedContent: { flex: 1, justifyContent: 'center', padding: 22, gap: 14 },
  lockedTitle: { color: palette.ink, fontSize: 25, fontWeight: '900' },
  lockedBody: { color: palette.muted, fontSize: 14, lineHeight: 21 },
});
