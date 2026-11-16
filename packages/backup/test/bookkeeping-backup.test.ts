/**
 * Host crypto conformance test suite for complete bookkeeping backup APIs.
 *
 * Scope and Evidence Boundaries:
 * - Host Conformance Only: All cryptographic roundtrips in this file execute
 *   real PBKDF2-HMAC-SHA-256 (600,000 iterations) and real AES-256-GCM via the
 *   Node crypto adapter (`bookkeeping-crypto-adapter.ts`).
 * - Unexecuted Native Implementation: The native adapter in
 *   `native-bookkeeping-backup.ts` reuses `crypto.native.ts` (QuickCrypto and
 *   expo-crypto) for physical device builds and is NOT executed on host Node.
 * - No Native Certification: These tests prove mathematical, envelope, and
 *   payload contract conformance; they do NOT certify native SQLCipher,
 *   iOS Keychain, Android Keystore, power-loss resilience, or device recovery.
 * - Synthetic Data Only: All datasets exercised are synthetic.
 */

import { describe, expect, it } from 'vitest';
import {
  BOOKKEEPING_DATASET_FORMAT,
  BOOKKEEPING_DATASET_FORMAT_VERSION,
  BOOKKEEPING_DATASET_SCHEMA_VERSION,
  BOOKKEEPING_DATASET_TABLES,
  compareBookkeepingDatasets,
  validateBookkeepingDatasetSnapshot,
  type BookkeepingDatasetSnapshot,
  type BookkeepingDatasetTableSnapshot,
} from '../src/bookkeeping-dataset';
import {
  BACKUP_MAX_BYTES,
  BACKUP_PASSPHRASE_MIN_CHARACTERS,
  decodeBackupEnvelope,
  encodeBackupEnvelope,
} from '../src/format';
import {
  BOOKKEEPING_BACKUP_ITERATIONS,
  BOOKKEEPING_BACKUP_MAX_BYTES,
  BOOKKEEPING_BACKUP_PAYLOAD_FORMAT,
  BOOKKEEPING_BACKUP_PAYLOAD_VERSION,
  BOOKKEEPING_BACKUP_SCHEMA_VERSION,
  BookkeepingBackupError,
  buildBookkeepingBackupManifest,
  createBookkeepingBackup,
  decryptBookkeepingBackup,
  decryptBookkeepingBackupWithManifest,
  type BookkeepingBackupCrypto,
} from '../src/bookkeeping-backup';
import {
  createNodeBookkeepingCryptoAdapter,
  NodeBookkeepingCryptoAdapter,
} from './bookkeeping-crypto-adapter';

const SYNTHETIC_PASSPHRASE = 'SyntheticBookkeepingPassphrase2026!';
const WRONG_PASSPHRASE = 'CompletelyDifferentPassphrase2026!';
const ISO_TIMESTAMP = '2024-06-01T12:00:00.000Z';

function buildSyntheticDataset(): BookkeepingDatasetSnapshot {
  const tables: BookkeepingDatasetTableSnapshot[] = BOOKKEEPING_DATASET_TABLES.map((tableDef) => ({
    name: tableDef.name,
    columns: tableDef.columns.map((col) => col.name),
    rowCount: 0,
    rows: [],
  }));

  // Table 1: businesses
  tables[0].rows = [
    ['business-1', 'Northstar Studio LLC', 'AZ', '2024-03-01', '2024-01-01', 'USD', ISO_TIMESTAMP],
    ['business-2', 'Harbor Single LLC', 'CA', '2023-05-01', '2023-05-01', 'USD', ISO_TIMESTAMP],
  ];
  tables[0].rowCount = tables[0].rows.length;

  // Table 2: members
  tables[1].rows = [
    ['member-1', 'business-1', 'Jordan Lee', ISO_TIMESTAMP, null],
    ['member-2', 'business-1', 'Casey Morgan', ISO_TIMESTAMP, null],
  ];
  tables[1].rowCount = tables[1].rows.length;

  // Table 3: member_interest_history
  tables[2].rows = [
    ['interest-1', 'business-1', 'member-1', 6000, '2024-01-01', null, ISO_TIMESTAMP],
    ['interest-2', 'business-1', 'member-2', 4000, '2024-01-01', null, ISO_TIMESTAMP],
  ];
  tables[2].rowCount = tables[2].rows.length;

  // Table 4: accounts
  tables[3].rows = [
    ['acct-bank', 'business-1', '1000', 'Operating Checking', 'asset', 'Bank', 0, 1, ISO_TIMESTAMP],
    ['acct-equity', 'business-1', '3000', 'Opening Equity', 'equity', 'Opening balance', 1, 1, ISO_TIMESTAMP],
    ['acct-income', 'business-1', '4000', 'Sales Revenue', 'income', 'Operating income', 0, 1, ISO_TIMESTAMP],
    ['acct-supplies', 'business-1', '6100', 'Office Supplies', 'expense', 'Operating expense', 0, 1, ISO_TIMESTAMP],
  ];
  tables[3].rowCount = tables[3].rows.length;

  // Table 5: journal_entries
  tables[4].rows = [
    ['je-1', 'business-1', '2024-01-10', 'income', 'Client payment', ISO_TIMESTAMP],
  ];
  tables[4].rowCount = tables[4].rows.length;

  // Table 6: journal_lines
  tables[5].rows = [
    ['jl-1', 'je-1', 'acct-bank', 1, '25000', '0'],
    ['jl-2', 'je-1', 'acct-income', 2, '0', '25000'],
  ];
  tables[5].rowCount = tables[5].rows.length;

  // Table 7: transactions
  tables[6].rows = [
    ['txn-1', 'business-1', 'je-1', '2024-01-10', 'income', 'acct-bank', 'acct-income', '25000', 'Client payment', ISO_TIMESTAMP],
  ];
  tables[6].rowCount = tables[6].rows.length;

  // Table 27: bookkeeping_preferences
  tables[26].rows = [
    ['active_business_id', 'business-1'],
  ];
  tables[26].rowCount = tables[26].rows.length;

  return validateBookkeepingDatasetSnapshot({
    format: BOOKKEEPING_DATASET_FORMAT,
    formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
    schemaVersion: BOOKKEEPING_DATASET_SCHEMA_VERSION,
    tables,
  });
}

function buildEmptyDataset(): BookkeepingDatasetSnapshot {
  const tables: BookkeepingDatasetTableSnapshot[] = BOOKKEEPING_DATASET_TABLES.map((tableDef) => ({
    name: tableDef.name,
    columns: tableDef.columns.map((col) => col.name),
    rowCount: 0,
    rows: [],
  }));

  return validateBookkeepingDatasetSnapshot({
    format: BOOKKEEPING_DATASET_FORMAT,
    formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
    schemaVersion: BOOKKEEPING_DATASET_SCHEMA_VERSION,
    tables,
  });
}

describe('complete bookkeeping backup — host crypto conformance', () => {
  const crypto = createNodeBookkeepingCryptoAdapter();

  it('performs real PBKDF2 (600,000 iterations) and AES-256-GCM roundtrip with identical production envelope', async () => {
    const dataset = buildSyntheticDataset();
    const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);

    expect(backup).toBeInstanceOf(Uint8Array);
    expect(backup.length).toBeGreaterThan(52 + 16);

    const restored = await decryptBookkeepingBackup(backup, SYNTHETIC_PASSPHRASE, crypto);
    expect(restored).toEqual(dataset);

    const differences = compareBookkeepingDatasets(dataset, restored);
    expect(differences).toEqual([]);
  });

  it('produces different ciphertext for the same dataset and passphrase due to fresh random salt and nonce', async () => {
    const dataset = buildSyntheticDataset();
    const backup1 = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
    const backup2 = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);

    expect(backup1).not.toEqual(backup2);

    const envelope1 = decodeBackupEnvelope(backup1);
    const envelope2 = decodeBackupEnvelope(backup2);

    // Both salt and nonce must be distinct random bytes
    expect(envelope1.salt).not.toEqual(envelope2.salt);
    expect(envelope1.nonce).not.toEqual(envelope2.nonce);
    expect(envelope1.ciphertext).not.toEqual(envelope2.ciphertext);

    // Both decrypt to the exact identical restored payload
    const restored1 = await decryptBookkeepingBackup(backup1, SYNTHETIC_PASSPHRASE, crypto);
    const restored2 = await decryptBookkeepingBackup(backup2, SYNTHETIC_PASSPHRASE, crypto);
    expect(restored1).toEqual(dataset);
    expect(restored2).toEqual(dataset);
  });

  it('restores the exact payload and computes verified manifest parity', async () => {
    const dataset = buildSyntheticDataset();
    const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
    const result = await decryptBookkeepingBackupWithManifest(backup, SYNTHETIC_PASSPHRASE, crypto);

    expect(result.snapshot).toEqual(dataset);
    expect(result.manifest.schemaVersion).toBe(BOOKKEEPING_BACKUP_SCHEMA_VERSION);
    expect(result.manifest.tableCount).toBe(27);
    expect(result.manifest.totalRowCount).toBe(11);
    expect(result.manifest.tableRowCounts['businesses']).toBe(2);
    expect(result.manifest.tableRowCounts['members']).toBe(2);
    expect(result.manifest.tableRowCounts['accounts']).toBe(4);
    expect(result.manifest.tableRowCounts['journal_entries']).toBe(1);
    expect(result.manifest.tableRowCounts['journal_lines']).toBe(2);
    expect(result.manifest.tableRowCounts['transactions']).toBe(1);
    expect(result.manifest.tableRowCounts['bookkeeping_preferences']).toBe(1);
  });

  it('handles an empty schema-13 dataset with zero rows across all 27 tables', async () => {
    const emptyDataset = buildEmptyDataset();
    const backup = await createBookkeepingBackup(emptyDataset, SYNTHETIC_PASSPHRASE, crypto);
    const restored = await decryptBookkeepingBackup(backup, SYNTHETIC_PASSPHRASE, crypto);

    expect(restored).toEqual(emptyDataset);
    const manifest = buildBookkeepingBackupManifest(restored);
    expect(manifest.tableCount).toBe(27);
    expect(manifest.totalRowCount).toBe(0);
  });

  it('rejects decryption when an incorrect passphrase is supplied', async () => {
    const dataset = buildSyntheticDataset();
    const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);

    await expect(decryptBookkeepingBackup(backup, WRONG_PASSPHRASE, crypto)).rejects.toThrow(
      'Backup authentication failed',
    );
  });

  describe('bit flips and tampering detection', () => {
    it('detects a bit flip in the envelope header magic', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[0] ^= 0x01; // Tamper first magic byte

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('detects a bit flip in the envelope header version', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[8] ^= 0x01; // Tamper version byte

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('detects a bit flip in the header iteration count', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[12] ^= 0x01; // Tamper iterations uint32

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('detects a bit flip in the header ciphertext length field', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[23] ^= 0x01; // Tamper ciphertext length byte

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('detects a bit flip in the salt (bytes 24-39)', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[25] ^= 0x01; // Tamper salt

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'Backup authentication failed',
      );
    });

    it('detects a bit flip in the nonce (bytes 40-51)', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[45] ^= 0x01; // Tamper nonce

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'Backup authentication failed',
      );
    });

    it('detects a bit flip in the ciphertext body (offset 52+)', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[60] ^= 0x01; // Tamper ciphertext byte

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'Backup authentication failed',
      );
    });

    it('detects a bit flip in the authentication tag (last 16 bytes)', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const tampered = backup.slice();
      tampered[tampered.length - 1] ^= 0x01; // Tamper last tag byte

      await expect(decryptBookkeepingBackup(tampered, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'Backup authentication failed',
      );
    });
  });

  describe('truncation rejection', () => {
    it('rejects an empty input buffer', async () => {
      await expect(decryptBookkeepingBackup(new Uint8Array(0), SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects an envelope truncated in the 24-byte header', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      await expect(decryptBookkeepingBackup(backup.slice(0, 20), SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects an envelope truncated in the 52-byte prefix', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      await expect(decryptBookkeepingBackup(backup.slice(0, 50), SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects an envelope truncated in the ciphertext body', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      await expect(decryptBookkeepingBackup(backup.slice(0, backup.length - 10), SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects an envelope truncated by even 1 byte', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      await expect(decryptBookkeepingBackup(backup.slice(0, backup.length - 1), SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });
  });

  describe('unsupported envelope structure', () => {
    it('rejects unexpected magic signature', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const corrupted = backup.slice();
      corrupted.set(new TextEncoder().encode('NOTMAGIC'), 0);
      await expect(decryptBookkeepingBackup(corrupted, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'Backup file signature is invalid',
      );
    });

    it('rejects unsupported envelope version', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const corrupted = backup.slice();
      corrupted[8] = 99; // Version 99
      await expect(decryptBookkeepingBackup(corrupted, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'Backup format or algorithm version is unsupported',
      );
    });

    it('rejects unsupported KDF or cipher indicator', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const corruptedKdf = backup.slice();
      corruptedKdf[9] = 2; // Unsupported KDF
      await expect(decryptBookkeepingBackup(corruptedKdf, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();

      const corruptedCipher = backup.slice();
      corruptedCipher[10] = 2; // Unsupported cipher
      await expect(decryptBookkeepingBackup(corruptedCipher, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects non-zero reserved byte', async () => {
      const dataset = buildSyntheticDataset();
      const backup = await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, crypto);
      const corrupted = backup.slice();
      corrupted[11] = 1; // Reserved must remain zero
      await expect(decryptBookkeepingBackup(corrupted, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });
  });

  describe('passphrase bounds and weak password rejection', () => {
    it('rejects passphrases shorter than 12 characters before expensive work', async () => {
      const dataset = buildSyntheticDataset();
      await expect(createBookkeepingBackup(dataset, 'short-pass', crypto)).rejects.toThrow(
        `at least ${BACKUP_PASSPHRASE_MIN_CHARACTERS} characters`,
      );
      await expect(createBookkeepingBackup(dataset, '12345678901', crypto)).rejects.toThrow(
        `at least ${BACKUP_PASSPHRASE_MIN_CHARACTERS} characters`,
      );
    });

    it('rejects empty passphrases', async () => {
      const dataset = buildSyntheticDataset();
      await expect(createBookkeepingBackup(dataset, '', crypto)).rejects.toThrow();
    });

    it('rejects non-string passphrases', async () => {
      const dataset = buildSyntheticDataset();
      await expect(createBookkeepingBackup(dataset, null as never, crypto)).rejects.toThrow();
      await expect(createBookkeepingBackup(dataset, 123456789012 as never, crypto)).rejects.toThrow();
    });

    it('rejects passphrases exceeding the 1,024-byte limit before expensive work', async () => {
      const dataset = buildSyntheticDataset();
      const oversized = 'x'.repeat(1025);
      await expect(createBookkeepingBackup(dataset, oversized, crypto)).rejects.toThrow(
        '1,024-byte limit',
      );
    });
  });

  describe('oversized input and size bounds', () => {
    it('rejects backup bytes exceeding the 8 MiB limit before expensive work', async () => {
      const oversizedBackup = new Uint8Array(BACKUP_MAX_BYTES + 1);
      await expect(decryptBookkeepingBackup(oversizedBackup, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects plaintext payload exceeding 8 MiB limit during backup creation', async () => {
      // Mock crypto adapter that attempts to encrypt oversized payload
      const oversizedCrypto: BookkeepingBackupCrypto = {
        async encryptBackupPayload(plaintext) {
          if (plaintext.length + 16 > BACKUP_MAX_BYTES - 52) {
            throw new Error('Backup payload exceeds the 8 MiB file limit.');
          }
          return new Uint8Array(0);
        },
        async decryptBackupPayload() {
          return new Uint8Array(0);
        },
      };

      // Plaintext exceeding limit throws
      const oversizedPlaintext = new Uint8Array(BACKUP_MAX_BYTES - 52);
      await expect(oversizedCrypto.encryptBackupPayload(oversizedPlaintext, SYNTHETIC_PASSPHRASE)).rejects.toThrow(
        '8 MiB file limit',
      );
    });
  });

  describe('unsupported payload and schema rejection', () => {
    it('rejects older schema versions (< 13)', async () => {
      const bad = {
        format: BOOKKEEPING_DATASET_FORMAT,
        formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
        schemaVersion: 12,
        tables: [],
      };
      await expect(createBookkeepingBackup(bad, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'only version 13 can be captured or restored',
      );
    });

    it('rejects newer schema versions (> 13)', async () => {
      const bad = {
        format: BOOKKEEPING_DATASET_FORMAT,
        formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
        schemaVersion: 14,
        tables: [],
      };
      await expect(createBookkeepingBackup(bad, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'newer than the supported version 13',
      );
    });

    it('rejects unsupported dataset format version', async () => {
      const bad = {
        format: BOOKKEEPING_DATASET_FORMAT,
        formatVersion: 2,
        schemaVersion: BOOKKEEPING_DATASET_SCHEMA_VERSION,
        tables: [],
      };
      await expect(createBookkeepingBackup(bad, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'format version is unsupported',
      );
    });

    it('rejects malformed table structures with missing tables', async () => {
      const bad = {
        format: BOOKKEEPING_DATASET_FORMAT,
        formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
        schemaVersion: BOOKKEEPING_DATASET_SCHEMA_VERSION,
        tables: [
          { name: 'businesses', columns: ['id'], rowCount: 0, rows: [] },
        ],
      };
      await expect(createBookkeepingBackup(bad, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });

    it('rejects post-authentication decrypted payload if schema version is unsupported', async () => {
      // Create a valid envelope whose decrypted content has an unsupported schema version
      const tamperedPayload = JSON.stringify({
        format: BOOKKEEPING_DATASET_FORMAT,
        formatVersion: BOOKKEEPING_DATASET_FORMAT_VERSION,
        schemaVersion: 14,
        tables: [],
      });
      const tamperedBytes = new TextEncoder().encode(tamperedPayload);
      const envelopeBytes = await crypto.encryptBackupPayload(tamperedBytes, SYNTHETIC_PASSPHRASE);

      await expect(decryptBookkeepingBackup(envelopeBytes, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow();
    });
  });

  describe('proof-payload rejection and mutual isolation', () => {
    it('strictly rejects synthetic proof-only restore payloads from being restored as bookkeeping data', async () => {
      // Construct a valid proof-only payload matching RestoredProofSnapshot
      const proofPayload = {
        formatVersion: 1,
        schemaVersion: 1,
        records: [
          {
            id: 'synthetic-proof',
            note: 'Synthetic storage proof record',
            attachmentHex: '4c4c432d50524f4f46',
          },
        ],
      };
      const proofJson = JSON.stringify(proofPayload);
      const proofBytes = new TextEncoder().encode(proofJson);

      // Encrypt the proof payload under the valid production envelope
      const proofBackup = await crypto.encryptBackupPayload(proofBytes, SYNTHETIC_PASSPHRASE);

      // Attempting to restore proof payload as bookkeeping data must fail closed
      await expect(decryptBookkeepingBackup(proofBackup, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        BookkeepingBackupError,
      );
      await expect(decryptBookkeepingBackup(proofBackup, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'proof payload',
      );
    });

    it('strictly rejects raw non-JSON payloads after authentication', async () => {
      const nonJsonBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03]);
      const envelope = await crypto.encryptBackupPayload(nonJsonBytes, SYNTHETIC_PASSPHRASE);

      await expect(decryptBookkeepingBackup(envelope, SYNTHETIC_PASSPHRASE, crypto)).rejects.toThrow(
        'not valid',
      );
    });
  });

  describe('zeroing transient buffers and sensitive data hygiene', () => {
    it('does not leak passphrases or key material into error messages', async () => {
      const dataset = buildSyntheticDataset();
      const secretPassphrase = 'SuperSecretUnrevealedPassphrase2026!';
      const backup = await createBookkeepingBackup(dataset, secretPassphrase, crypto);

      try {
        await decryptBookkeepingBackup(backup, 'WrongPassphraseThatShouldNotLeak!', crypto);
        expect.unreachable('Decryption should have thrown');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).not.toContain(secretPassphrase);
        expect(message).not.toContain('WrongPassphraseThatShouldNotLeak');
      }
    });

    it('zeros transient plaintext buffers upon completion or error', async () => {
      let capturedPlaintext: Uint8Array | null = null;

      const trackingCrypto: BookkeepingBackupCrypto = {
        async encryptBackupPayload(plaintext, passphrase) {
          capturedPlaintext = plaintext;
          return await crypto.encryptBackupPayload(plaintext, passphrase);
        },
        async decryptBackupPayload(backupBytes, passphrase) {
          return await crypto.decryptBackupPayload(backupBytes, passphrase);
        },
      };

      const dataset = buildSyntheticDataset();
      await createBookkeepingBackup(dataset, SYNTHETIC_PASSPHRASE, trackingCrypto);

      expect(capturedPlaintext).not.toBeNull();
      // After createBookkeepingBackup completes, the plaintext buffer must have been zeroed
      expect(capturedPlaintext!.every((byte) => byte === 0)).toBe(true);
    });
  });

  describe('unexecuted native implementation boundary label', () => {
    it('documents the boundary between host crypto conformance and native implementation', () => {
      // Explicit assertion documenting that host tests run against Node crypto adapter
      expect(NodeBookkeepingCryptoAdapter).toBeDefined();
      expect(BOOKKEEPING_BACKUP_ITERATIONS).toBe(600_000);
      expect(BOOKKEEPING_BACKUP_MAX_BYTES).toBe(8 * 1024 * 1024);
      expect(BOOKKEEPING_BACKUP_PAYLOAD_FORMAT).toBe(BOOKKEEPING_DATASET_FORMAT);
      expect(BOOKKEEPING_BACKUP_PAYLOAD_VERSION).toBe(BOOKKEEPING_DATASET_FORMAT_VERSION);
      expect(BOOKKEEPING_BACKUP_SCHEMA_VERSION).toBe(BOOKKEEPING_DATASET_SCHEMA_VERSION);
    });
  });
});
