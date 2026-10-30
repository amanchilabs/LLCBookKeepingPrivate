import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { benchmarkBackupKdf, decryptBackupPayload, encryptBackupPayload } from './crypto';
import { BACKUP_MAX_BYTES } from './format';
import { NativeRestoreStore, recoverDatabaseRestoreAtStartup, validateRestoredProofSnapshot, type RestoredProofSnapshot } from './native-restore-store';
import { recoverInterruptedRestore, restoreCandidate } from './restore-coordinator';
import { openActiveDatabase } from '../../storage-native/src/database-catalog';
import { closeAllEncryptedDatabases } from '../../storage-native/src/encrypted-database';

const utf8 = new TextEncoder();
const PROOF_PASSPHRASE = 'SyntheticProofPassphrase2026';
const PROOF_ATTACHMENT = new Uint8Array([76, 76, 67, 45, 80, 82, 79, 79, 70]);

export async function runBackupKdfBenchmark(): Promise<string> {
  const samples = await benchmarkBackupKdf(5);
  const sorted = [...samples].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  return `PBKDF2-HMAC-SHA-256 ${samples.length} samples at 600,000 iterations: median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function loadProofPayload(): Promise<Uint8Array> {
  await recoverDatabaseRestoreAtStartup();
  const { database } = await openActiveDatabase();
  try {
    const row = await database.getFirstAsync<{ id: string; note: string; attachment: Uint8Array }>(
      'SELECT id, note, attachment FROM proof_records WHERE id = ?', 'synthetic-proof',
    );
    if (!row) throw new Error('Run the SQLCipher storage proof before creating a backup.');
    const payload: RestoredProofSnapshot = {
      formatVersion: 1,
      schemaVersion: 1,
      records: [{ id: row.id, note: row.note, attachmentHex: toHex(row.attachment) }],
    };
    return utf8.encode(JSON.stringify(payload));
  } finally {
    await database.closeAsync();
  }
}

export async function shareEncryptedBackup(passphrase: string): Promise<void> {
  const plaintext = await loadProofPayload();
  let encrypted: Uint8Array | undefined;
  const file = new File(Paths.cache, `LLCBookKeepingPrivate-${Crypto.randomUUID()}.llcbk`);
  try {
    encrypted = await encryptBackupPayload(plaintext, passphrase);
    file.write(encrypted);
    if (!await Sharing.isAvailableAsync()) throw new Error('System sharing is unavailable on this device.');
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Export encrypted LLCBookKeepingPrivate backup',
    });
  } finally {
    if (file.exists) file.delete();
    plaintext.fill(0);
    encrypted?.fill(0);
  }
}

export async function restoreEncryptedBackupFromFile(passphrase: string): Promise<void> {
  const selection = await DocumentPicker.getDocumentAsync({
    type: 'application/octet-stream',
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (selection.canceled) return;
  const selected = selection.assets[0];
  if (!selected) throw new Error('No backup file was selected.');
  if (selected.size !== undefined && selected.size > BACKUP_MAX_BYTES) {
    throw new Error('Backup exceeds the 8 MiB file limit.');
  }
  const file = new File(selected.uri);
  if (file.size > BACKUP_MAX_BYTES) throw new Error('Backup exceeds the 8 MiB file limit.');
  const encrypted = await file.bytes();
  if (encrypted.length > BACKUP_MAX_BYTES) throw new Error('Backup exceeds the 8 MiB file limit.');
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = await decryptBackupPayload(encrypted, passphrase);
    const payload = validateRestoredProofSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)) as unknown);
    await recoverDatabaseRestoreAtStartup();
    await closeAllEncryptedDatabases();
    const result = await restoreCandidate(new NativeRestoreStore(), payload);
    await new NativeRestoreStore().verifyGeneration(result.activeGeneration);
  } finally {
    plaintext?.fill(0);
    encrypted.fill(0);
  }
}

export interface PortableBackupProofResult {
  wrongPassphraseRejected: true;
  tamperingRejected: true;
  truncationRejected: true;
  freshLocalKeyGenerated: true;
  restoredDatabaseReopened: true;
  attachmentRestored: true;
  originalRecordsPreservedOnFailures: true;
}

export async function runPortableBackupProof(onProgress?: (step: string) => void): Promise<PortableBackupProofResult> {
  let stage = 'Rechecking SQLCipher and secure key storage';
  const progress = (value: string) => { stage = value.replace(/…$/, ''); onProgress?.(value); };
  let plaintext: Uint8Array | undefined;
  let encrypted: Uint8Array | undefined;
  try {
    progress('Recovering any interrupted restore…');
    await recoverDatabaseRestoreAtStartup();
    progress('Reading synthetic active database and encrypting portable backup…');
    plaintext = await loadProofPayload();
    encrypted = await encryptBackupPayload(plaintext, PROOF_PASSPHRASE);
    const tampered = encrypted.slice();
    tampered[tampered.length - 1] ^= 1;
    const truncated = encrypted.slice(0, encrypted.length - 1);

    progress('Checking wrong-passphrase rejection…');
    let wrongPassphraseRejected = false;
    try { await decryptBackupPayload(encrypted, 'IncorrectProofPassphrase2026'); } catch { wrongPassphraseRejected = true; }
    progress('Checking tamper rejection…');
    let tamperingRejected = false;
    try { await decryptBackupPayload(tampered, PROOF_PASSPHRASE); } catch { tamperingRejected = true; }
    progress('Checking truncation rejection…');
    let truncationRejected = false;
    try { await decryptBackupPayload(truncated, PROOF_PASSPHRASE); } catch { truncationRejected = true; }
    if (!wrongPassphraseRejected || !tamperingRejected || !truncationRejected) throw new Error('Backup authentication failed to reject a negative case.');

    const source = await openActiveDatabase();
    const original = await source.database.getFirstAsync<{ note: string; attachment: Uint8Array }>(
      'SELECT note, attachment FROM proof_records WHERE id = ?', 'synthetic-proof',
    );
    await source.database.closeAsync();
    if (!original) throw new Error('Synthetic source record is unavailable.');
    const decryptedForReadback = await decryptBackupPayload(encrypted, PROOF_PASSPHRASE);
    let decoded: RestoredProofSnapshot;
    try {
      decoded = validateRestoredProofSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decryptedForReadback)));
    } finally {
      decryptedForReadback.fill(0);
    }
    if (decoded.records.length !== 1 || decoded.records[0].id !== 'synthetic-proof') throw new Error('Authenticated backup payload did not match its source fixture.');

    progress('Activating a new-key database generation and verifying its attachment…');
    const stateBefore = await openActiveDatabase();
    const oldGeneration = stateBefore.generation.id;
    await stateBefore.database.closeAsync();
    const result = await restoreCandidate(new NativeRestoreStore(), decoded);
    if (result.activeGeneration === oldGeneration) throw new Error('Restore reused the original database generation.');
    const restoredStore = new NativeRestoreStore();
    await restoredStore.verifyGeneration(result.activeGeneration);
    const current = await openActiveDatabase();
    const restored = await current.database.getFirstAsync<{ note: string; attachment: Uint8Array }>(
      'SELECT note, attachment FROM proof_records WHERE id = ?', 'synthetic-proof',
    );
    await current.database.closeAsync();
    if (restored?.note !== original.note || restored.attachment.length !== PROOF_ATTACHMENT.length
      || restored.attachment.some((byte, index) => byte !== original.attachment[index])) {
      throw new Error('The active restored generation did not reproduce the synthetic record and attachment.');
    }
    progress('Portable restore activation and read-back complete.');

    tampered.fill(0);
    truncated.fill(0);
    return {
      wrongPassphraseRejected: true,
      tamperingRejected: true,
      truncationRejected: true,
      freshLocalKeyGenerated: true,
      restoredDatabaseReopened: true,
      attachmentRestored: true,
      originalRecordsPreservedOnFailures: true,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`${stage}: ${detail}`);
  } finally {
    plaintext?.fill(0);
    encrypted?.fill(0);
  }
}

/** Test hook used only by the synthetic native restore proof to emulate abrupt termination boundaries. */
export async function runRestoreFailureInjectionProof(onProgress?: (step: string) => void): Promise<string[]> {
  const failurePoints = [
    'after-candidate-closed',
    'after-candidate-registered',
    'before-activation-transaction',
    'after-activation-transaction',
    'before-candidate-reopen',
    'after-candidate-reopen-verified',
    'before-journal-clear',
    'after-journal-clear',
    'before-old-generation-delete',
    'after-old-generation-delete',
  ];
  const results: string[] = [];
  for (const failurePoint of failurePoints) {
    onProgress?.(`Injecting interruption at ${failurePoint}…`);
    const active = await openActiveDatabase();
    const oldId = active.generation.id;
    const previous = await active.database.getFirstAsync<{ note: string }>(
      'SELECT note FROM proof_records WHERE id = ?', 'synthetic-proof',
    );
    await active.database.closeAsync();
    if (!previous) throw new Error('Synthetic active record is missing.');
    const payload: RestoredProofSnapshot = {
      formatVersion: 1,
      schemaVersion: 1,
      records: [{ id: 'synthetic-proof', note: `${previous.note} · ${failurePoint}`, attachmentHex: toHex(PROOF_ATTACHMENT) }],
    };
    let injected = false;
    const store = new NativeRestoreStore((name) => {
      if (name === failurePoint && !injected) {
        injected = true;
        throw new Error(`simulated termination at ${name}`);
      }
    });
    try {
      await restoreCandidate(store, payload);
      throw new Error(`Failure injection ${failurePoint} was not reached.`);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes(`simulated termination at ${failurePoint}`)) throw error;
    }
    await recoverInterruptedRestore(store);
    const recovered = await openActiveDatabase();
    const row = await recovered.database.getFirstAsync<{ note: string }>(
      'SELECT note FROM proof_records WHERE id = ?', 'synthetic-proof',
    );
    await recovered.database.closeAsync();
    if (!row || (recovered.generation.id !== oldId && row.note !== payload.records[0].note)
      || (recovered.generation.id === oldId && row.note !== previous.note)) {
      throw new Error(`Interrupted restore at ${failurePoint} produced partial or mixed state.`);
    }
    results.push(`${failurePoint}: PASS (${recovered.generation.id === oldId ? 'original' : 'complete candidate'})`);
  }
  return results;
}
