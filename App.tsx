import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { capabilitiesFor, SYNTHETIC_PREVIEW_NOTICE } from './apps/mobile/preview-capabilities';
import { recoverDatabaseRestoreAtStartup } from './packages/backup/src/native-restore-store';
import { restoreEncryptedBackupFromFile, runBackupKdfBenchmark, runPortableBackupProof, runRestoreFailureInjectionProof, shareEncryptedBackup } from './packages/backup/src/native-portable-backup';
import { runNativeStorageProof, type NativeStorageProofResult } from './packages/storage-native/src/encrypted-database';

type PreviewTab = 'Overview' | 'Members' | 'Transactions' | 'Loans' | 'Reports';

const tabs: PreviewTab[] = ['Overview', 'Members', 'Transactions', 'Loans', 'Reports'];
const transactions = [
  { date: 'Oct 28', label: 'Cloud hosting', category: 'Operating expenses', amount: '−$148.00', kind: 'expense' },
  { date: 'Oct 26', label: 'Member contribution', category: 'Capital contribution', amount: '+$2,500.00', kind: 'capital' },
  { date: 'Oct 23', label: 'Office supplies', category: 'Operating expenses', amount: '−$86.42', kind: 'expense' },
  { date: 'Oct 18', label: 'Loan advance · Jordan Lee', category: 'Member loan', amount: '+$4,000.00', kind: 'loan' },
];

function PreviewScreen() {
  const [tab, setTab] = useState<PreviewTab>('Overview');
  const [showPreviewNote, setShowPreviewNote] = useState(false);
  const compact = useWindowDimensions().width < 780;
  const data = tab === 'Members'
    ? [{ name: 'Jordan Lee', detail: '40% suggested interest', value: '$7,500.00' }, { name: 'Casey Morgan', detail: '20% suggested interest', value: '$2,500.00' }, { name: 'Riley Patel', detail: '20% suggested interest', value: '$1,200.00' }, { name: 'Avery Kim', detail: '20% suggested interest', value: '$1,200.00' }]
    : tab === 'Loans'
      ? [{ name: 'Jordan Lee', detail: 'Synthetic tranche loan · ACT/365F', value: '$12,000.00' }, { name: 'Casey Morgan', detail: 'No active loan', value: '$0.00' }]
      : tab === 'Reports'
        ? [{ name: 'Profit & loss', detail: 'Cash basis · Jan 1 – Oct 30, 2026', value: 'View sample' }, { name: 'Trial balance', detail: 'Synthetic books · USD', value: 'View sample' }, { name: 'CPA workpapers', detail: 'No tax filing or K-1 generation', value: 'Preview only' }]
        : transactions.map((item) => ({ name: item.label, detail: `${item.date} · ${item.category}`, value: item.amount }));

  return (
    <View style={[styles.previewRoot, compact && styles.previewRootCompact]}>
      {!compact && <View style={styles.previewSidebar}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
        <Text style={styles.brandName}>LLCBookKeeping<Text style={styles.brandNamePrivate}>Private</Text></Text>
        <Text style={styles.workspaceLabel}>LOCAL WORKSPACE</Text>
        <View style={styles.navItems}>
          {tabs.map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.navButton, tab === item && styles.navButtonSelected]}>
              <Text style={[styles.navButtonText, tab === item && styles.navButtonTextSelected]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.sidebarFoot}><View style={styles.offlineDot} /><Text style={styles.sidebarFootText}>On-device preview</Text></View>
      </View>}

      <ScrollView style={styles.previewMain} contentContainerStyle={[styles.previewContent, compact && styles.previewContentCompact]}>
        {compact && <>
          <View style={styles.mobileBrandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View><Text style={styles.mobileBrandName}>LLCBookKeeping<Text style={styles.mobileBrandNamePrivate}>Private</Text></Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNav}>
            {tabs.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.navButton, styles.mobileNavButton, tab === item && styles.mobileNavButtonSelected]}><Text style={[styles.navButtonText, tab === item && styles.mobileNavButtonTextSelected]}>{item}</Text></Pressable>)}
          </ScrollView>
        </>}
        <View style={styles.topBar}>
          <View><Text style={styles.topBarLabel}>BUSINESS WORKSPACE</Text><Text style={styles.businessName}>Northstar Studio LLC</Text></View>
          <View style={styles.topBarRight}><View style={styles.yearPill}><Text style={styles.yearPillText}>2026 · USD</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>NS</Text></View></View>
        </View>

        <View style={styles.previewNotice}><View style={styles.noticeIcon}><Text style={styles.noticeIconText}>i</Text></View><Text style={styles.previewNoticeText}>{SYNTHETIC_PREVIEW_NOTICE}</Text></View>

        <View style={[styles.headingRow, compact && styles.headingRowCompact]}>
          <View><Text style={styles.pageTitle}>{tab === 'Overview' ? 'Books at a glance' : tab}</Text><Text style={styles.pageSubtitle}>A clear view of your books, kept on this device.</Text></View>
          <Pressable accessibilityRole="button" onPress={() => setShowPreviewNote(!showPreviewNote)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>＋  New transaction</Text></Pressable>
        </View>
        {showPreviewNote && <View style={styles.previewActionNote}><Text style={styles.previewActionNoteText}>This preview uses sample information. Transaction entry is disabled here.</Text></View>}

        {tab === 'Overview' ? (
          <>
            <View style={styles.metricGrid}>
              <MetricCard label="Cash on hand" value="$68,402.18" note="Across 2 sample accounts" accent="green" />
              <MetricCard label="Income · YTD" value="$42,850.00" note="Cash basis · 2026" accent="blue" />
              <MetricCard label="Expenses · YTD" value="$9,680.12" note="Includes review buckets" accent="plum" />
              <MetricCard label="Member loans" value="$12,000.00" note="Principal outstanding" accent="amber" />
            </View>

            <View style={[styles.contentGrid, compact && styles.contentGridCompact]}>
              <View style={styles.panel}>
                <View style={styles.panelHeading}><View><Text style={styles.panelTitle}>Recent activity</Text><Text style={styles.panelSubtitle}>Manually recorded sample transactions</Text></View><Pressable onPress={() => setTab('Transactions')}><Text style={styles.linkText}>View all</Text></Pressable></View>
                <View style={styles.activityHeader}><Text style={styles.rowDate}>DATE</Text><Text style={styles.rowDescription}>DESCRIPTION</Text><Text style={styles.rowAmount}>AMOUNT</Text></View>
                {transactions.map((item) => <View style={styles.activityRow} key={item.label}><Text style={styles.rowDate}>{item.date}</Text><View style={styles.rowDescription}><Text style={styles.transactionName}>{item.label}</Text><Text style={styles.transactionCategory}>{item.category}</Text></View><Text style={[styles.rowAmount, item.kind !== 'expense' && styles.positiveAmount]}>{item.amount}</Text></View>)}
              </View>

              <View style={styles.rightColumn}>
                <View style={styles.memberPanel}><View style={styles.panelHeading}><View><Text style={styles.panelTitle}>Member interests</Text><Text style={styles.panelSubtitle}>Suggested · not yet confirmed</Text></View></View>
                  {['Jordan Lee|40%', 'Casey Morgan|20%', 'Riley Patel|20%', 'Avery Kim|20%'].map((member, index) => { const [name, percent] = member.split('|'); return <View key={name} style={styles.memberRow}><View style={[styles.memberAvatar, { backgroundColor: ['#e4efe7', '#e9edf7', '#f5eade', '#eee8f3'][index] }]}><Text style={styles.memberInitial}>{name.split(' ').map((part) => part[0]).join('')}</Text></View><Text style={styles.memberName}>{name}</Text><Text style={styles.memberPercent}>{percent}</Text></View>; })}
                </View>
                <View style={styles.reviewPanel}><View style={styles.reviewBadge}><Text style={styles.reviewBadgeText}>CPA REVIEW</Text></View><Text style={styles.reviewTitle}>3 items need a closer look</Text><Text style={styles.reviewBody}>Startup costs and one member-paid expense are set aside for review.</Text><Pressable onPress={() => setTab('Reports')}><Text style={styles.linkText}>Open review list →</Text></Pressable></View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.listPanel}><View style={styles.panelHeading}><View><Text style={styles.panelTitle}>{tab === 'Members' ? 'Four sample members' : tab === 'Loans' ? 'Loan records' : tab === 'Reports' ? 'Workpapers and reports' : 'Sample transactions'}</Text><Text style={styles.panelSubtitle}>Synthetic data only · nothing is saved</Text></View></View>
            {data.map((item) => <View key={item.name} style={styles.listRow}><View><Text style={styles.transactionName}>{item.name}</Text><Text style={styles.transactionCategory}>{item.detail}</Text></View><Text style={styles.rowAmount}>{item.value}</Text></View>)}
          </View>
        )}

        <View style={styles.previewControls}><Text style={styles.previewControlsTitle}>Native-only capabilities</Text><Text style={styles.previewControlsBody}>To protect real records, CSV import, receipt attachments, encrypted backup, and restore are disabled in this browser preview.</Text><View style={styles.disabledActions}><View style={styles.disabledAction}><Text style={styles.disabledActionText}>Import CSV</Text></View><View style={styles.disabledAction}><Text style={styles.disabledActionText}>Add receipt</Text></View><View style={styles.disabledAction}><Text style={styles.disabledActionText}>Backup & restore</Text></View></View></View>
        <Text style={styles.footerText}>Synthetic example · No account, bank connection, or payment processing</Text>
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) {
  return <View style={styles.metricCard}><View style={[styles.metricAccent, { backgroundColor: accentColor(accent) }]} /><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricNote}>{note}</Text></View>;
}

function accentColor(accent: string) {
  return ({ green: '#427a57', blue: '#667cab', plum: '#8e7197', amber: '#b68a45' } as Record<string, string>)[accent] ?? '#427a57';
}

function NativeProofScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Run the native checks on an iOS or Android development build.');
  const [storageResult, setStorageResult] = useState<NativeStorageProofResult | null>(null);
  const [passphrase, setPassphrase] = useState('SyntheticProofPassphrase2026');
  const [backupResult, setBackupResult] = useState<string | null>(null);
  useEffect(() => {
    recoverDatabaseRestoreAtStartup()
      .then((result) => setMessage(`Startup restore recovery: ${result}. Run native checks on this development build.`))
      .catch((error: unknown) => setMessage(error instanceof Error ? `Startup storage recovery failed closed: ${error.message}` : 'Startup storage recovery failed closed.'));
  }, []);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage('Running native proof…');
    try { await task(); setMessage('Proof finished. Review each result below.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Native proof failed.'); }
    finally { setBusy(false); }
  };
  const runStorage = () => run(async () => setStorageResult(await runNativeStorageProof()));
  const runBackup = () => run(async () => {
    const result = await runPortableBackupProof(setMessage);
    setBackupResult(Object.entries(result).map(([name, value]) => `${name}: ${value ? 'PASS' : 'FAIL'}`).join('\n'));
  });
  const runRestoreRecovery = () => run(async () => {
    const results = await runRestoreFailureInjectionProof(setMessage);
    setBackupResult(results.join('\n'));
  });
  const runKdfBenchmark = () => run(async () => {
    setBackupResult(await runBackupKdfBenchmark());
  });

  return <SafeAreaView style={styles.nativeSafeArea}><ScrollView style={styles.nativeRoot} contentContainerStyle={styles.nativeContent}>
    <Text style={styles.nativeBrand}>LLCBookKeepingPrivate</Text>
    <Text style={styles.nativeTitle}>Native security proof</Text>
    <Text style={styles.nativeSubtitle}>Synthetic records only. Run this screen in iOS and Android development builds; Expo Go is not supported.</Text>
    <View style={styles.nativeNotice}><Text style={styles.nativeNoticeText}>The browser preview cannot validate SQLCipher, platform key storage, or device security.</Text></View>
    <View style={styles.nativePanel}><Text style={styles.nativeSectionTitle}>Encrypted local database</Text><Text style={styles.nativeBody}>Creates a 32-byte random device key, stores it with SecureStore, checks SQLCipher availability, writes a synthetic record and attachment, reopens the database, then verifies a wrong key fails.</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={runStorage} style={[styles.nativeButton, busy && styles.buttonDisabled]}><Text style={styles.nativeButtonText}>Run SQLCipher + key-storage proof</Text></Pressable>
      {storageResult && <View style={styles.resultBox}><Text style={styles.resultText}>SQLCipher: {storageResult.cipherVersion}{'\n'}Secure key stored: PASS{'\n'}Database reopened: PASS{'\n'}Record + attachment persisted: PASS{'\n'}Wrong key rejected: PASS{'\n'}Database: {storageResult.databaseName}{'\n'}Path: {storageResult.databasePath}</Text></View>}
    </View>
    <View style={styles.nativePanel}><Text style={styles.nativeSectionTitle}>Encrypted portable backup</Text><Text style={styles.nativeBody}>AES-256-GCM, random 16-byte salt, 12-byte nonce, PBKDF2-HMAC-SHA-256 at 600,000 iterations, and authenticated format metadata. Restore builds and validates a separate SQLCipher database with a new local key, then switches an encrypted catalog pointer in a durable SQLite transaction.</Text>
      <TextInput accessibilityLabel="Backup passphrase" secureTextEntry value={passphrase} onChangeText={setPassphrase} style={styles.passphraseInput} autoCapitalize="none" />
      <View style={styles.nativeButtonRow}><Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => shareEncryptedBackup(passphrase))} style={[styles.nativeButton, busy && styles.buttonDisabled]}><Text style={styles.nativeButtonText}>Export encrypted proof backup</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => restoreEncryptedBackupFromFile(passphrase))} style={[styles.secondaryButton, busy && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>Restore backup file</Text></Pressable></View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={runBackup} style={[styles.secondaryButton, styles.fullWidthButton, busy && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>Run in-memory restore and tamper proofs</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={runRestoreRecovery} style={[styles.secondaryButton, styles.fullWidthButton, busy && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>Inject restore interruptions and recover</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={runKdfBenchmark} style={[styles.secondaryButton, styles.fullWidthButton, busy && styles.buttonDisabled]}><Text style={styles.secondaryButtonText}>Measure native backup KDF</Text></Pressable>
      {backupResult && <View style={styles.resultBox}><Text style={styles.resultText}>{backupResult}</Text></View>}
    </View>
    {busy && <ActivityIndicator color="#47765b" style={styles.spinner} />}
    <Text accessibilityLiveRegion="polite" style={styles.nativeStatus}>{message}</Text>
    <Text style={styles.nativeFootnote}>This proof validates a limited synthetic-data slice. Run file-based restore in both platform directions. Simulator/emulator results are not physical-device evidence; production readiness remains unverified.</Text>
  </ScrollView></SafeAreaView>;
}

export default function App() {
  const capabilities = capabilitiesFor(Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android');
  return capabilities.syntheticDataOnly ? <PreviewScreen /> : <NativeProofScreen />;
}

const styles = StyleSheet.create({
  previewRoot: { flex: 1, flexDirection: 'row', backgroundColor: '#f6f7f3', minHeight: '100vh' as never },
  previewRootCompact: { flexDirection: 'column' },
  previewSidebar: { width: 236, backgroundColor: '#18352a', paddingHorizontal: 20, paddingTop: 26, paddingBottom: 20 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#c8decf', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  brandMarkText: { color: '#18352a', fontSize: 18, fontWeight: '800' },
  brandName: { color: '#f4f7f3', fontSize: 14, fontWeight: '700', letterSpacing: -0.3 },
  brandNamePrivate: { color: '#9fc1a9', fontWeight: '500' },
  workspaceLabel: { color: '#91a99a', fontSize: 9, letterSpacing: 1.4, fontWeight: '700', marginTop: 48, marginBottom: 13 },
  navItems: { gap: 5 },
  navButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 9 },
  navButtonSelected: { backgroundColor: '#2c4a3b' },
  navButtonText: { color: '#b5c6bb', fontSize: 13, fontWeight: '500' },
  navButtonTextSelected: { color: '#f7faf7', fontWeight: '700' },
  sidebarFoot: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#345042', paddingTop: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  offlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#82bd91' },
  sidebarFootText: { color: '#a9c0b0', fontSize: 11 },
  previewMain: { flex: 1 },
  previewContent: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 42, paddingBottom: 34 },
  previewContentCompact: { paddingHorizontal: 16, paddingBottom: 26 },
  mobileBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 8 },
  mobileBrandName: { color: '#18352a', fontSize: 14, fontWeight: '700', letterSpacing: -0.3 },
  mobileBrandNamePrivate: { color: '#4c7659', fontWeight: '500' },
  mobileNav: { gap: 4, paddingBottom: 13 },
  mobileNavButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 7 },
  mobileNavButtonSelected: { backgroundColor: '#dfe9df' },
  mobileNavButtonTextSelected: { color: '#31533b' },
  topBar: { minHeight: 76, borderBottomWidth: 1, borderBottomColor: '#e4e8e1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  topBarLabel: { color: '#77837a', fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginBottom: 4 },
  businessName: { color: '#23362b', fontSize: 14, fontWeight: '700' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  yearPill: { borderWidth: 1, borderColor: '#e1e6df', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
  yearPillText: { fontSize: 10, color: '#506258', fontWeight: '700' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e4ece4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#44614c', fontSize: 10, fontWeight: '800' },
  previewNotice: { flexDirection: 'row', gap: 11, padding: 13, borderRadius: 9, backgroundColor: '#edf3eb', borderWidth: 1, borderColor: '#dce8db', alignItems: 'center' },
  noticeIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#d5e5d6', alignItems: 'center', justifyContent: 'center' },
  noticeIconText: { color: '#426c4c', fontWeight: '800', fontSize: 12 },
  previewNoticeText: { color: '#385343', fontSize: 11, lineHeight: 16, flex: 1, fontWeight: '600' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 20, gap: 16 },
  headingRowCompact: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 20, gap: 12 },
  pageTitle: { color: '#23372b', fontSize: 26, fontWeight: '700', letterSpacing: -0.7 },
  pageSubtitle: { color: '#78847b', fontSize: 12, marginTop: 5 },
  primaryButton: { backgroundColor: '#28543d', borderRadius: 8, minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  previewActionNote: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 14, borderWidth: 1, borderColor: '#dce5db' },
  previewActionNoteText: { color: '#5d6e62', fontSize: 11 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  metricCard: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14, minWidth: 190, flexGrow: 1, flexBasis: '20%', borderWidth: 1, borderColor: '#e7ebe5' },
  metricAccent: { width: 22, height: 3, borderRadius: 2, marginBottom: 13 },
  metricLabel: { color: '#77847b', fontSize: 10, fontWeight: '600' },
  metricValue: { color: '#27392e', fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 7 },
  metricNote: { color: '#97a099', fontSize: 9, marginTop: 6 },
  contentGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 15, marginTop: 16 },
  contentGridCompact: { flexDirection: 'column' },
  panel: { flex: 1.7, backgroundColor: '#fff', borderRadius: 10, padding: 17, borderWidth: 1, borderColor: '#e7ebe5', minWidth: 320 },
  panelHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  panelTitle: { color: '#2d4034', fontSize: 13, fontWeight: '700' },
  panelSubtitle: { color: '#98a099', fontSize: 9, marginTop: 4 },
  linkText: { color: '#4a7658', fontSize: 10, fontWeight: '700' },
  activityHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#edf0eb', paddingBottom: 9 },
  rowDate: { width: 56, color: '#a0aaa2', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  rowDescription: { flex: 1 },
  rowAmount: { width: 94, textAlign: 'right', color: '#48584d', fontSize: 10, fontWeight: '700' },
  activityRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f2ef' },
  transactionName: { color: '#34463a', fontSize: 10, fontWeight: '700' },
  transactionCategory: { color: '#9aa39c', fontSize: 9, marginTop: 4 },
  positiveAmount: { color: '#4c7d59' },
  rightColumn: { flex: 1, minWidth: 230, gap: 14 },
  memberPanel: { backgroundColor: '#fff', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#e7ebe5' },
  memberRow: { flexDirection: 'row', alignItems: 'center', minHeight: 39, gap: 9 },
  memberAvatar: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberInitial: { color: '#536859', fontSize: 8, fontWeight: '800' },
  memberName: { color: '#59685e', fontSize: 9, flex: 1 },
  memberPercent: { color: '#42594a', fontSize: 9, fontWeight: '700' },
  reviewPanel: { backgroundColor: '#f3f0e9', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#eae4d8' },
  reviewBadge: { alignSelf: 'flex-start', backgroundColor: '#e7ddc8', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4 },
  reviewBadgeText: { color: '#806a3f', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  reviewTitle: { color: '#4a4438', fontSize: 12, fontWeight: '700', marginTop: 12 },
  reviewBody: { color: '#80786a', fontSize: 10, lineHeight: 15, marginTop: 5, marginBottom: 12 },
  listPanel: { backgroundColor: '#fff', borderRadius: 10, padding: 17, borderWidth: 1, borderColor: '#e7ebe5', marginBottom: 18 },
  listRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f0f2ef', gap: 12 },
  previewControls: { backgroundColor: '#eef1ed', borderRadius: 10, padding: 16, marginTop: 17 },
  previewControlsTitle: { color: '#536257', fontSize: 11, fontWeight: '700' },
  previewControlsBody: { color: '#7f8b81', fontSize: 10, lineHeight: 15, marginTop: 5 },
  disabledActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  disabledAction: { borderWidth: 1, borderColor: '#dce1db', backgroundColor: '#f4f6f3', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8 },
  disabledActionText: { color: '#a1aaa2', fontSize: 9, fontWeight: '600' },
  footerText: { textAlign: 'center', color: '#a0aaa1', fontSize: 9, marginTop: 18 },
  nativeRoot: { flex: 1, backgroundColor: '#f5f7f4' },
  nativeSafeArea: { flex: 1, backgroundColor: '#f5f7f4' },
  nativeContent: { padding: 22, maxWidth: 760, width: '100%', alignSelf: 'center', paddingBottom: 50 },
  nativeBrand: { color: '#375442', fontSize: 13, fontWeight: '700', marginTop: 12 },
  nativeTitle: { color: '#23372b', fontSize: 28, fontWeight: '700', marginTop: 18 },
  nativeSubtitle: { color: '#65736a', fontSize: 14, lineHeight: 21, marginTop: 7 },
  nativeNotice: { borderRadius: 8, borderWidth: 1, borderColor: '#e4d9c1', backgroundColor: '#f6f0e3', padding: 12, marginTop: 17 },
  nativeNoticeText: { color: '#675b43', fontSize: 12, lineHeight: 18 },
  nativePanel: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6ebe5', padding: 16, marginTop: 17 },
  nativeSectionTitle: { color: '#304436', fontSize: 16, fontWeight: '700' },
  nativeBody: { color: '#727e75', fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 12 },
  nativeButtonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  nativeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 8, backgroundColor: '#28543d' },
  nativeButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 8, borderWidth: 1, borderColor: '#cbd8ce', backgroundColor: '#f3f7f3' },
  secondaryButtonText: { color: '#42634d', fontSize: 11, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  fullWidthButton: { marginTop: 9 },
  passphraseInput: { borderWidth: 1, borderColor: '#dce4dc', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 10, color: '#384a3d', marginBottom: 10, fontSize: 13 },
  resultBox: { borderRadius: 8, backgroundColor: '#eef4ef', padding: 12, marginTop: 12 },
  resultText: { color: '#3c5b44', fontSize: 11, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  spinner: { marginTop: 18 },
  nativeStatus: { color: '#4c6755', fontSize: 12, marginTop: 16 },
  nativeFootnote: { color: '#909a92', fontSize: 10, lineHeight: 15, marginTop: 17 },
});
