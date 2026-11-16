# Bookkeeping Portable Backup Format & Encrypted Recovery Specification

- Status: **Builder-delivered for RECOVERY-002; coordinator validation and independent review pending; host Node crypto conformance evidence only**
- Milestone / Capability: **CAP-BOOK-RECOVERY-001 — Complete Bookkeeping Recovery**
- Story: **RECOVERY-002 — Passphrase-encrypted complete dataset backup APIs**
- Authorization: **Owner authorization 2026-11-16 ([`AUTHORIZATION-20261116.md`](AUTHORIZATION-20261116.md))**
- Implementation Plan: **[`IMPLEMENTATION-PLAN-20261116.md`](IMPLEMENTATION-PLAN-20261116.md)**
- Dataset Contract Specification: **[`DATASET-COVERAGE.md`](DATASET-COVERAGE.md)**
- Source Modules:
  - Pure Non-UI Backup APIs & Manifest Validation: [`packages/backup/src/bookkeeping-backup.ts`](../../packages/backup/src/bookkeeping-backup.ts)
  - Native Platform Adapter: [`packages/backup/src/native-bookkeeping-backup.ts`](../../packages/backup/src/native-bookkeeping-backup.ts)
  - Host Conformance Test Suite: [`packages/backup/test/bookkeeping-backup.test.ts`](../../packages/backup/test/bookkeeping-backup.test.ts)
  - Host Node Crypto Adapter: [`packages/backup/test/bookkeeping-crypto-adapter.ts`](../../packages/backup/test/bookkeeping-crypto-adapter.ts)
  - Shared Envelope Definition: [`packages/backup/src/format.ts`](../../packages/backup/src/format.ts)
  - Native Production Crypto Implementation: [`packages/backup/src/crypto.native.ts`](../../packages/backup/src/crypto.native.ts)
  - Web Preview Fallback: [`packages/backup/src/crypto.web.ts`](../../packages/backup/src/crypto.web.ts)

---

## 1. Scope, Status & Governance Boundaries

This document defines the exact binary layout, cryptographic parameters, payload contract, post-authentication verification pipeline, and execution boundaries for portable encrypted backups delivered under Story **RECOVERY-002**.

### Evidence Boundaries & Unverified Gates
- **Host Conformance Evidence Only**: Current automated validation runs in Node via [`packages/backup/test/bookkeeping-crypto-adapter.ts`](../../packages/backup/test/bookkeeping-crypto-adapter.ts) using the standard Web Cryptography API (`globalThis.crypto.subtle`) in Node 24. This exercises real PBKDF2-HMAC-SHA-256 (600,000 iterations), real AES-256-GCM authenticated encryption/decryption, envelope tamper rejection, bit-flip detection, truncation rejection, strict canonical payload decoding, and zero-leak memory hygiene on host runtimes.
- **Unexecuted Native Platform Implementation**: The native adapter in [`packages/backup/src/native-bookkeeping-backup.ts`](../../packages/backup/src/native-bookkeeping-backup.ts) and native cryptography in [`packages/backup/src/crypto.native.ts`](../../packages/backup/src/crypto.native.ts) depend on `react-native-quick-crypto` and `expo-crypto`. These modules require physical devices or compiled development builds and are **not** executed on host test runtimes.
- **No Native or Physical-Device Certification**: Host tests **do not** certify native SQLCipher encryption, iOS Keychain, Android Keystore, device power-loss resilience, or physical-device recovery.
- **Subsequent Story Gate**:
  - **RECOVERY-003**: Isolated candidate database restore orchestration, complete synthetic dataset parity verification across all financial reports (profit & loss, balance sheet, trial balance, general ledger), failure injection, and migration handling.
- **No Real Financial Data or Production Use**: All data exercised is synthetic. Real financial records and production deployment remain strictly barred pending full gate completion. Bank connections or automated scraping remain permanently forbidden under the canonical vision ([`CLAUDE.md`](../../CLAUDE.md)).
- **Visual & UI Immutability**: All 64 owner change receipts and UI baselines remain preserved and unchanged. This milestone is strictly non-UI.
- **Proof Backup Separation**: The existing synthetic proof backup utility in [`packages/backup/src/native-portable-backup.ts`](../../packages/backup/src/native-portable-backup.ts) remains intact and distinct; no UI controls are wired to either backup system.

---

## 2. Authenticated Portable Envelope Specification (Format Version 2)

The bookkeeping backup uses the **EXISTING authenticated portable AES-GCM/PBKDF2 envelope** defined in [`packages/backup/src/format.ts`](../../packages/backup/src/format.ts).

### 2.1 Binary Layout & Byte Offsets

A complete backup file consists of a 52-byte authenticated header prefix followed by the AES-256-GCM ciphertext and 16-byte authentication tag:

```
+-------------------------------------------------------------------------+
|                              HEADER (24 bytes)                          |
+-------------------+---------+-----+--------+----------+-----------------+
| Magic (8 bytes)   | Ver (1) | KDF | Cipher | Rsvd (1) | Iterations (4B) |
| "LLCBKUP\0"       | 0x02    | 0x01| 0x01   | 0x00     | 600,000 (BE)    |
+-------------------+---------+-----+--------+----------+-----------------+
| Salt Len (2B, 16) | Nonce Len (1B, 12)     | Tag Len (1B, 16)           |
+-------------------+------------------------+----------------------------+
| Ciphertext Length (4 bytes, Big-Endian uint32)                          |
+-------------------------------------------------------------------------+
|                              SALT (16 bytes)                            |
| Bytes 24 to 39: Cryptographically random salt for PBKDF2 key derivation |
+-------------------------------------------------------------------------+
|                              NONCE (12 bytes)                           |
| Bytes 40 to 51: Cryptographically random IV/nonce for AES-256-GCM       |
+-------------------------------------------------------------------------+
|                    CIPHERTEXT & AUTHENTICATION TAG                      |
| Bytes 52 to End: AES-256-GCM ciphertext + 16-byte GCM authentication tag|
+-------------------------------------------------------------------------+
```

### 2.2 Header Field Inventory

| Field | Offset | Length | Type | Expected Value | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MAGIC` | `0..7` | 8 bytes | ASCII | `LLCBKUP\0` (`0x4c 0x4c 0x43 0x42 0x4b 0x55 0x50 0x00`) | Portable backup file signature |
| `VERSION` | `8` | 1 byte | uint8 | `2` (`0x02`) | Envelope format version (version 1 is permanently unsupported) |
| `KDF_ID` | `9` | 1 byte | uint8 | `1` (`0x01`) | PBKDF2-HMAC-SHA-256 |
| `CIPHER_ID` | `10` | 1 byte | uint8 | `1` (`0x01`) | AES-256-GCM |
| `RESERVED` | `11` | 1 byte | uint8 | `0` (`0x00`) | Reserved; must be strictly zero |
| `ITERATIONS` | `12..15` | 4 bytes | uint32 (BE) | `600,000` (`0x000927C0`) | PBKDF2 iteration count |
| `SALT_LENGTH` | `16..17` | 2 bytes | uint16 (BE) | `16` (`0x0010`) | Salt length in bytes |
| `NONCE_LENGTH`| `18` | 1 byte | uint8 | `12` (`0x0C`) | Nonce / IV length in bytes |
| `TAG_LENGTH` | `19` | 1 byte | uint8 | `16` (`0x10`) | GCM authentication tag length in bytes |
| `CIPHERTEXT_LEN` | `20..23` | 4 bytes | uint32 (BE) | `plaintext.length + 16` | Total length of ciphertext body including tag |
| `SALT` | `24..39` | 16 bytes | Raw bytes | Cryptographically random | PBKDF2 derivation salt |
| `NONCE` | `40..51` | 12 bytes | Raw bytes | Cryptographically random | AES-GCM initialization vector |
| `CIPHERTEXT` | `52..end` | Variable | Raw bytes | Encrypted payload + tag | AES-256-GCM encrypted payload, terminating in 16-byte tag |

### 2.3 Additional Authenticated Data (AAD)

The **first 52 bytes** of the file (Header 24 bytes + Salt 16 bytes + Nonce 12 bytes) constitute the `authenticatedMetadata` passed directly as Additional Authenticated Data (AAD) to AES-256-GCM:
- Any modification, bit-flip, or corruption in the header magic, version, iteration count, ciphertext length, salt, or nonce causes AES-GCM tag verification to fail during decryption.
- The ciphertext cannot be detached from its parameters or associated with different metadata.

### 2.4 Strict Size Bounds

- **Minimum File Size**: `52 (prefix) + 16 (tag) = 68 bytes`.
- **Maximum File Size**: `8 * 1024 * 1024 bytes = 8,388,608 bytes` (8 MiB, `BACKUP_MAX_BYTES`).
- **Maximum Plaintext Size**: `BACKUP_MAX_BYTES - 52 (prefix) - 16 (tag) = 8,388,540 bytes`.
- **Passphrase Size Bounds**: Minimum `12` characters; maximum `1,024` UTF-8 bytes (`BACKUP_PASSPHRASE_MIN_CHARACTERS`, `BACKUP_PASSPHRASE_MAX_UTF8_BYTES`). Enforced prior to initiating cryptographic operations.

---

## 3. Cryptographic Key Derivation & Encryption Engine

### 3.1 Key Derivation: PBKDF2-HMAC-SHA-256
- **Passphrase Ingestion**: Passphrase string is validated for length (`>= 12` characters) and encoded to UTF-8 (`<= 1,024` bytes).
- **Salt**: 16 bytes of cryptographically secure random bytes generated via `randomBytes` (Node) or `Crypto.getRandomBytesAsync` (native).
- **Iterations**: Fixed at `600,000` iterations (`BACKUP_ITERATIONS`).
- **Derived Key**: 256 bits (32 bytes) derived key material.
- **Passphrase & Key Cleanup**: Input passphrase byte arrays and derived key buffers are zeroed (`fill(0)`) immediately after cipher instantiation.

### 3.2 Cipher: AES-256-GCM
- **Key**: 256-bit derived key from PBKDF2.
- **IV / Nonce**: 12 bytes of cryptographically secure random bytes generated fresh for every encryption.
- **AAD**: Exactly the 52-byte authenticated prefix (`authenticatedMetadata`).
- **Tag**: 16-byte authentication tag generated by AES-GCM and appended to the ciphertext.
- **Randomization Guarantee**: Because fresh 16-byte salt and 12-byte nonce are generated on every call, encrypting identical bookkeeping data twice with the same passphrase produces entirely different ciphertexts.

---

## 4. Bookkeeping Payload Contract & Proof Utility Separation

### 4.1 Explicit Discriminator & Version
The decrypted plaintext is the strict canonical JSON representation of `BookkeepingDatasetSnapshot` created under RECOVERY-001:
- **Format Discriminator**: `llc-bookkeeping-dataset` (`BOOKKEEPING_DATASET_FORMAT`)
- **Format Version**: `1` (`BOOKKEEPING_DATASET_FORMAT_VERSION`)
- **Schema Version**: Exactly `13` (`BOOKKEEPING_DATASET_SCHEMA_VERSION`)
- **Top-Level Keys**: Exactly `['format', 'formatVersion', 'schemaVersion', 'tables']`.

### 4.2 Mutual Rejection: Bookkeeping vs Proof-Only Payloads

The synthetic storage and restore proof utilities ([`packages/backup/src/native-restore-store.ts`](../../packages/backup/src/native-restore-store.ts)) use a proof-only snapshot format:
```json
{
  "formatVersion": 1,
  "schemaVersion": 1,
  "records": [
    { "id": "synthetic-proof", "note": "Synthetic storage proof record", "attachmentHex": "4c4c432d50524f4f46" }
  ]
}
```

#### Rejection Rules:
1. **Proof Payloads Cannot Be Restored as Books**:
   - Proof snapshots have `schemaVersion: 1`, lack `format: "llc-bookkeeping-dataset"`, and contain `records` instead of `tables`.
   - `decryptBookkeepingBackup` explicitly identifies proof payloads and fails closed with error code `proof-payload-rejected` and message:
     `"The backup contains a proof payload and cannot be restored as bookkeeping data."`
2. **Bookkeeping Payloads Cannot Be Restored as Proofs**:
   - Proof recovery in `native-restore-store.ts` requires `schemaVersion === 1` and `records`. When presented with a bookkeeping payload, it fails closed immediately (`Restored database schema version is unsupported` or missing records).

---

## 5. Defense-in-Depth Validation Pipeline

Both creation and decryption follow strict fail-closed validation pipelines:

### 5.1 Backup Creation Pipeline (`createBookkeepingBackup`)
1. **Passphrase Bounds Check**: Validates passphrase type and string length (`>= 12` characters, `<= 1024` UTF-8 bytes) before performing any snapshot validation or serialization.
2. **Snapshot Validation**: Invokes `validateBookkeepingDatasetSnapshot(dataset)` to verify schema version 13, all 27 tables, column definitions, data types, and referential integrity.
3. **Manifest Parity**: Verifies that table count equals 27 and row counts match row arrays (`assertBookkeepingBackupManifest`).
4. **Canonical Serialization**: Serializes via `serializeBookkeepingDataset(snapshot)`, ensuring deterministic key ordering, table sequence, and code-unit primary key ordering.
5. **Enclosed Lifecycle Allocation**: Plaintext is encoded into a UTF-8 `Uint8Array`. Immediately upon allocation, execution enters a `try / finally` block ensuring `plaintext.fill(0)` is executed on every completion or failure path.
6. **Payload Size Enforced**: Proves `plaintext.length + 16 <= 8,388,608 - 52`. Oversized payloads throw `payload-too-large`.
7. **Protected Adapter Resolution & Encryption**: Resolves `encryptBackupPayload` from the injected crypto boundary within the protected lifecycle (so missing methods or throwing getters trigger cleanup), invokes the cipher, and wipes plaintext in `finally`.

### 5.2 Backup Decryption Pipeline (`decryptBookkeepingBackup`)
1. **Envelope Bounds Pre-Check**: Proves input is `Uint8Array`, length between 68 bytes and 8 MiB, and passphrase is valid string before invoking KDF.
2. **Envelope Header Integrity**: Invokes `decodeBackupEnvelope(backup)` to verify magic `LLCBKUP\0`, version `2`, KDF `1`, cipher `1`, reserved `0`, iterations `600,000`, salt length `16`, nonce length `12`, tag length `16`, and ciphertext length matching file size. Any corruption fails immediately before expensive key derivation.
3. **AES-GCM Authentication & Decryption**: Injected crypto adapter derives key and decrypts ciphertext with AAD. Mismatched tag, bit-flip, or wrong passphrase throws `authentication-failed`.
4. **Fatal UTF-8 Decoding**: Decodes plaintext using `new TextDecoder('utf-8', { fatal: true })`. Zeros plaintext buffer (`fill(0)`) in a `finally` block.
5. **JSON Parse & Proof Rejection**: Parses JSON. Explicitly checks for proof-only structures (`records` present, `format` missing, or `schemaVersion === 1`) and throws `proof-payload-rejected`.
6. **Strict Canonical Schema Validation**: Invokes `parseBookkeepingDataset(decodedText)`. Verifies canonical JSON formatting (re-serialization equals input), schema version `13`, all 27 tables, and foreign-key integrity.
7. **Manifest Assertion**: Proves all 27 tables are present, table sequence matches `BOOKKEEPING_DATASET_TABLES`, and each table's `rowCount === rows.length`. Returns verified `BookkeepingDatasetSnapshot`.

---

## 6. Keychain Independence & Sensitive Data Hygiene

- **Keychain Independence**: Decryption requires **only** the user passphrase and backup bytes. It does not access, read, or require the original device's Keychain or Keystore keys. A backup created on one device can be decrypted on any other device without access to the source device's hardware secrets.
- **No Keys in Logs or Errors**: Error messages never embed the user passphrase, derived key material, plaintext content, or financial amounts.
- **Zero Transient Plaintext Buffers**: Plaintext buffers created during encryption and decryption are explicitly overwritten with zeroes (`buffer.fill(0)`) in `finally` blocks when owned. This includes all failure modes: missing crypto adapter methods, throwing getters during resolution, oversized payload rejection, and encryption/decryption failures.
- **Atomic Authenticated Decryption**: Decryption via WebCrypto (`globalThis.crypto.subtle`) performs atomic authenticated decryption where unauthenticated plaintext is never released if authentication tag verification fails, eliminating unsafe intermediate plaintext buffers. Passphrase buffers are wiped (`passphraseBytes.fill(0)`) on all execution paths.

---

## 7. Architectural Boundaries & Module Inventory

```
+--------------------------------------------------------------------------+
|                        bookkeeping-backup.ts                             |
|  Pure non-UI createBookkeepingBackup / decryptBookkeepingBackup          |
|  Manifest builder, strict decode, bounds enforcement, proof rejection    |
+-----------------------------------+--------------------------------------+
                                    |
                    +---------------+---------------+
                    | Injected Crypto Boundary      |
                    | BookkeepingBackupCrypto       |
                    +---------------+---------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
+---------v-------------------------+       +-----------------v------------------+
| native-bookkeeping-backup.ts      |       | bookkeeping-crypto-adapter.ts      |
| Production Native Adapter         |       | Host Node Crypto Adapter           |
| (QuickCrypto + expo-crypto)       |       | (Standard Node 24 WebCrypto)       |
| Uses crypto.native.ts on device;  |       | Used in host automated test        |
| crypto.web.ts on browser preview. |       | suites; real 600,000 PBKDF2 round- |
| Status: UNEXECUTED IN HOST TESTS  |       | trips with production envelope.    |
+-----------------------------------+       +------------------------------------+
```

---

## 8. Test Coverage Matrix & Conformance Audit

The host conformance test suite in [`packages/backup/test/bookkeeping-backup.test.ts`](../../packages/backup/test/bookkeeping-backup.test.ts) exercises all required scenarios:

| Category | Test Scenario | Verified Behavior |
| :--- | :--- | :--- |
| **Real Cryptography** | PBKDF2 (600,000 iter) + AES-256-GCM roundtrip | Full roundtrip succeeds under production envelope |
| **Randomization** | Different ciphertext for same data | Fresh random salt and nonce produce distinct bytes |
| **Parity** | Exact restored payload & manifest | Restored dataset has 0 differences via `compareBookkeepingDatasets`; manifest confirms 15 rows across 8 tables (2 businesses, 2 members, 2 member_interest_history, 4 accounts, 1 journal_entry, 2 journal_lines, 1 transaction, 1 preference) |
| **Empty Dataset** | Complete empty schema-13 dataset | All 27 tables round-trip with 0 rows |
| **Authentication** | Wrong passphrase | Fails with `Backup authentication failed` |
| **Tampering** | Bit flip in header magic (`LLCBKUP\0`) | Throws corrupt signature error |
| **Tampering** | Bit flip in header version (`2`) | Throws unsupported version error |
| **Tampering** | Bit flip in header iterations (`600,000`) | Throws parameter mismatch error |
| **Tampering** | Bit flip in header ciphertext length | Throws corrupt length error |
| **Tampering** | Bit flip in salt (bytes 24-39) | Fails AES-GCM tag verification |
| **Tampering** | Bit flip in nonce (bytes 40-51) | Fails AES-GCM tag verification |
| **Tampering** | Bit flip in ciphertext body (offset 52+) | Fails AES-GCM tag verification |
| **Tampering** | Bit flip in authentication tag | Fails AES-GCM tag verification |
| **Truncation** | Truncated header (0 to 20 bytes) | Rejected by size / envelope bounds |
| **Truncation** | Truncated prefix (50 bytes) | Rejected by envelope bounds |
| **Truncation** | Truncated ciphertext (-10 bytes) | Rejected by ciphertext length check |
| **Truncation** | Truncated tag (-1 byte) | Rejected by ciphertext length check |
| **Envelope** | Unsupported format version (`99`) | Throws unsupported version error |
| **Envelope** | Unsupported KDF or cipher (`2`) | Throws unsupported parameter error |
| **Envelope** | Non-zero reserved byte (`1`) | Throws unsupported parameter error |
| **Bounds** | Passphrase < 12 characters | Rejected before expensive PBKDF2 work |
| **Bounds** | Empty or non-string passphrase | Rejected before expensive PBKDF2 work |
| **Bounds** | Passphrase > 1,024 bytes | Rejected before expensive PBKDF2 work |
| **Bounds** | Backup > 8 MiB file limit | Rejected before expensive PBKDF2 work |
| **Bounds** | Plaintext payload > 8 MiB limit | Tested against public `createBookkeepingBackup` API with valid >8 MiB synthetic dataset; asserts `payload-too-large` error before crypto is called |
| **Schema** | Schema version < 13 (`12`) | Rejected with `only version 13 can be captured or restored` |
| **Schema** | Schema version > 13 (`14`) | Rejected with `newer than the supported version 13` |
| **Schema** | Dataset format version != 1 | Rejected with `format version is unsupported` |
| **Schema** | Malformed tables / missing tables | Rejected fail-closed |
| **Isolation** | Proof-only payload (`RestoredProofSnapshot`) | Decryption rejects with `proof-payload-rejected` |
| **Data Hygiene** | Zeroing transient plaintext buffers | Verifies plaintext buffer zeroed after successful backup creation |
| **Data Hygiene** | Zeroing plaintext on oversized failure | Verifies transient plaintext buffer zeroed when payload exceeds 8 MiB |
| **Data Hygiene** | Zeroing plaintext on encryption failure | Verifies plaintext buffer zeroed when crypto adapter encrypt method rejects |
| **Data Hygiene** | Zeroing plaintext on throwing getter | Verifies plaintext buffer zeroed when adapter resolution encounters throwing getter |
| **Data Hygiene** | Zeroing plaintext on missing adapter | Verifies plaintext buffer zeroed when adapter lacks required encryption method |
| **Privacy** | Sensitive data in errors | Error messages do not contain passphrases or keys |
| **Boundary** | Host vs native implementation | Explicit test banner documenting unexecuted native implementation |

---

## 9. Remaining Unverified Gates (Story 3 & Beyond)

The completion of Story RECOVERY-002 establishes the authenticated encryption and decryption boundary. The following gates remain open:
1. **Story RECOVERY-003**: Isolated restore orchestration into candidate databases, accounting report parity verification across multi-business synthetic datasets, transaction correction histories, member equity and capital movements, loan facilities, guaranteed payments, reconciliations, reminders, failure injection, and migration handling.
2. **Physical Device Recovery**: Execution on physical iOS and Android hardware using native SQLCipher and Keychain/Keystore.
3. **No Real Financial Data**: All work remains strictly synthetic until owner gate review passes.
4. **UI Wireframe & User Experience**: User-facing recovery screens remain on hold pending exact owner screen approval.
