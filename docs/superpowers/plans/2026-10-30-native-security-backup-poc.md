# Native Security and Backup Proof Implementation Plan

> **For agentic workers:** Execute this plan inline, task by task. Each task uses checkbox steps and is committed as a coherent checkpoint.

**Goal:** Demonstrate fail-closed SQLCipher storage, native key persistence, encrypted attachment BLOBs, and passphrase-portable AES-GCM backup/restore on iOS and Android while keeping the localhost preview synthetic-only.

**Architecture:** Expo SDK 58 and React Native provide one native app plus a browser-only preview. Pure TypeScript packages own money/interest and backup-container logic; native SQLite is SQLCipher-keyed through SecureStore; attachments are BLOBs inside the encrypted database; Expo Crypto provides AES-GCM/CSPRNG and React Native Quick Crypto provides native PBKDF2.

**Tech Stack:** Expo 58.0.21, React Native 0.88.1, React 19.3.0, expo-sqlite 58.0.14, expo-secure-store 58.0.2, expo-crypto 58.0.7, expo-file-system 58.0.13, expo-dev-client 58.0.17, react-native-quick-crypto 1.1.9, decimal.js 10.6.0, Vitest 5.0.5, TypeScript 6.0.3, Node 24.22.2.

**Spec:** docs/architecture/ADR-0001-native-local-storage-and-portable-backup.md and docs/security/dependency-inventory.md

**Execution status (2026-10-30):** Implemented the Expo scaffold, synthetic-only Web preview, a small pure TypeScript domain slice, the versioned backup envelope, native SQLCipher/SecureStore proof, and native in-memory backup proof. Twelve automated tests pass. The iOS 26.5 Simulator and Android API 36 Pixel 8 AVD native proofs passed; Android's first Gradle attempt exhausted disk space, but a retry built and installed successfully. An iOS-created backup restored and was verified on a freshly reinstalled Android build. Android-to-iOS restore, fresh-install restore on iOS, SQLCipher-disabled native build, physical-device tests, and release readiness remain pending. Do not treat this plan as completed for those items and do not start the full bookkeeping MVP yet.

## Global Constraints

- Project name is LLCBookKeepingPrivate.
- Work only on feature/native-security-backup-poc-20261030; never implement on main.
- GitHub repository is public; commit synthetic data only and no secrets or real financial records.
- Expo Web is a synthetic-data UI preview only, with the exact warning in the ADR and no CSV/receipt import or persistence.
- Native security evidence requires development builds, not Expo Go.
- Require SQLCipher before applying a key; absence of cipher support fails closed before data access.
- Use only exact direct dependency versions listed in docs/security/dependency-inventory.md.
- No backend, cloud sync, bank feed, invoicing, payment processing, remote AI, analytics, crash reporting, remote config, or OTA updates.
- Backup KDF is PBKDF2-HMAC-SHA-256, 600,000 iterations, 16-byte random salt, 32-byte output; AES-GCM uses a 12-byte random nonce and 16-byte tag. Benchmark before any release claim.
- Native key is 32 random bytes held by SecureStore. Restore generates a fresh local key; backup requires only file and passphrase.
- Use decimal.js only for pure domain calculations; do not convert financial values to JavaScript Number.
- Every normal stopping point commits and pushes all intended work, verifies local HEAD equals the upstream branch, and leaves no unexplained untracked files.

---

## Files and boundaries

- app.config.ts: SDK config, SQLCipher plugin switch for negative fail-closed build, disabled updates, and exact bundle identifiers.
- package.json / package-lock.json: exact direct package pins and local scripts.
- App.tsx: native security diagnostics and synthetic-only web preview.
- packages/domain/src/money.ts, loan-interest.ts: pure decimal parse and simple-interest policy.
- packages/domain/test/: independent deterministic domain tests.
- packages/backup/src/format.ts, crypto.native.ts, crypto.web.ts, native-portable-backup.ts: proof byte format, native passphrase encryption, and in-memory proof restore. Crash-safe staged replacement is not implemented.
- packages/backup/test/: format, crypto, tamper, truncation, and schema validation tests.
- packages/storage-native/src/encrypted-database.ts: SQLCipher availability, SecureStore key lifecycle, and synthetic encrypted database/BLOB fixture. Production migrations and attachment service are not implemented.
- packages/storage-native/test/: host-independent contract tests where possible; runtime assertions in the native diagnostics screen.
- scripts/verify-native-db.sh: export simulator/emulator database copies and verify ordinary SQLite cannot read them.
- docs/security/native-proof-results.md: actual platform, device type, build variant, commands, and results.

## API contracts

```ts
// packages/domain/src/money.ts
export type MoneyParseResult = { ok: true; value: Decimal } | { ok: false; reason: 'invalid' | 'out_of_range' };
export function parseMoneyText(input: string): MoneyParseResult;
export function toMinorUnits(value: Decimal, rounding: 'half_up'): bigint;

// packages/domain/src/loan-interest.ts
export type LoanEvent = { kind: 'advance' | 'principal_repayment'; date: string; amount: Decimal };
export type InterestPolicy = { annualRate: Decimal; dayCount: 'ACT_365_FIXED' | 'ACT_ACT_CALENDAR_YEAR'; sameDayOrder: 'repayment_before_advance'; precisionDigits: 40; rounding: 'half_up_cents_at_output' };
export type InterestSegment = { fromDate: string; toDate: string; principal: Decimal; days: number; interest: Decimal };
export function calculateSimpleInterest(events: readonly LoanEvent[], policy: InterestPolicy): readonly InterestSegment[];

// packages/backup/src/crypto.ts
export type RandomBytes = (length: number) => Promise<Uint8Array>;
export type BackupHeader = { formatVersion: 1; schemaVersion: 1; kdf: 'PBKDF2-HMAC-SHA-256'; iterations: 600000; salt: Uint8Array; cipher: 'AES-256-GCM'; nonce: Uint8Array; payloadEncoding: 'UTF-8-JSON'; ciphertextLength: number };
export function encodeBackupHeader(header: BackupHeader): Uint8Array;
export function parseBackupHeader(file: Uint8Array): BackupHeader;
export function encryptBackup(payload: Uint8Array, passphrase: string, randomBytes: RandomBytes): Promise<Uint8Array>;
export function decryptBackup(file: Uint8Array, passphrase: string): Promise<Uint8Array>;

// packages/storage-native/src/secure-database.ts
export interface SqliteConnection {
  getFirstAsync<T>(sql: string): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  closeAsync(): Promise<void>;
}
export interface NativeSqliteAdapter { open(name: string): Promise<SqliteConnection>; }
export interface SecureStoreAdapter { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; }
export type SecureDatabaseOptions = { sqlite: NativeSqliteAdapter; secureStore: SecureStoreAdapter; randomBytes: (length: number) => Promise<Uint8Array>; databaseExists: () => Promise<boolean> };
export interface SecureDatabase {
  cipherVersion(): Promise<string>;
  putSyntheticAttachment(id: string, bytes: Uint8Array, sha256: string): Promise<void>;
  readSyntheticAttachment(id: string): Promise<Uint8Array | null>;
  close(): Promise<void>;
}
export function openSecureDatabase(options: SecureDatabaseOptions): Promise<SecureDatabase>;
```

The database driver and SecureStore are injected into the secure database initializer so missing-cipher and missing-key behavior can be tested without pretending a host test is a native test. The native diagnostics screen runs the same initializer with the actual native modules.

## Task 1: Scaffold the pinned Expo project and local preview boundary

**Files:** package.json, package-lock.json, app.config.ts, tsconfig.json, apps/mobile/App.tsx, apps/mobile/index.ts, apps/mobile/preview-capabilities.ts, apps/mobile/preview-capabilities.test.ts, .gitignore.

- [ ] Add the exact direct dependencies from the inventory with exact versions, plus SDK-aligned web dependencies and development-only Expo Dev Client. Run `npm install` and save the generated package-lock.json.
- [ ] Set app name LLCBookKeepingPrivate, SQLCipher plugin true by default, updates disabled, and separate iOS/Android bundle identifiers for the proof.
- [ ] Add a configuration switch that can create a deliberately non-SQLCipher native build for the negative test; default remains SQLCipher enabled.
- [ ] Write preview-capability tests first. Assert web capability denies transaction entry, CSV, receipt, backup, and persistence actions, while native capability enables only security diagnostics. Run `npm run test:preview`; verify the failure is for missing exports.
- [ ] Use a failing assertion such as `expect(capabilitiesFor('web').canImportCsv).toBe(false)` before implementing capabilities; run `npm run test:preview` and confirm the function is missing.
- [ ] Implement the smallest platform-capability function and render the web branch as static synthetic presentation with the exact warning. Do not add input fields, import controls, browser persistence, receipt selection, or backup actions.
- [ ] Manually verify the localhost web page shows the exact warning and no transaction/import/receipt/backup controls.
- [ ] Add npm scripts for web preview, iOS native build, Android native build, domain tests, backup tests, and typecheck. Set EXPO_NO_TELEMETRY=1 in Expo CLI scripts.
- [ ] Run npx expo-doctor and npx expo config --type public; fix only SDK compatibility issues.
- [ ] Commit and push the scaffold checkpoint after reviewing all new files for secrets and remote dependencies.

## Task 2: Write failing tests for platform-independent money and interest policies

**Files:** packages/domain/src/money.ts, packages/domain/src/loan-interest.ts, packages/domain/test/money.test.ts, packages/domain/test/loan-interest.test.ts, vitest.config.ts.

- [ ] Write money parser tests for decimal strings, cents boundary, negative values, invalid exponent/NaN forms, and explicit half-up rounding at the posting boundary.
- [ ] Use assertions against `parseMoneyText('12.34')`, `parseMoneyText('1e3')`, and `toMinorUnits(new Decimal('1.005'), 'half_up')`; keep Decimal imports inside the domain test package.
- [ ] Run npm run test:domain and verify tests fail because the domain functions are absent.
- [ ] Write simple-interest tests using explicit ISO business dates, ACT/365 and ACT/366 policy inputs, same-day event ordering, repayment before advance rejection, and no interest before an advance.
- [ ] Run the targeted tests and confirm expected missing-function failures.
- [ ] Implement the smallest pure TypeScript functions using decimal.js and injected policies; never import React Native, Expo, or SQLite.
- [ ] Re-run targeted tests, then the full domain test command; record exact output.
- [ ] Commit and push the pure-domain checkpoint.

## Task 3: Write failing tests for backup serialization and cryptographic envelope

**Files:** packages/backup/src/format.ts, packages/backup/src/crypto.ts, packages/backup/test/format.test.ts, packages/backup/test/crypto.test.ts.

- [ ] Define an eight-byte magic, versioned fixed-order header schema, 4 KiB header bound, 8 MiB payload bound, 600,000 PBKDF2-HMAC-SHA-256 rounds, 16-byte salt, 12-byte nonce, 32-byte derived key, and 16-byte GCM tag.
- [ ] Add tests first for a deterministic header parser and payload schema rejection; run them and verify expected failures.
- [ ] Assert that `parseBackupHeader(encodeBackupHeader(header))` returns the same versioned metadata and that changing the final tag makes `decryptBackup` reject.
- [ ] Add tests for round-trip, wrong passphrase, one-bit header alteration, one-bit ciphertext alteration, truncated header/tag, overlong header, over-limit payload, unsupported version, and invalid attachment length/hash.
- [ ] Run targeted tests to confirm failures are caused by unimplemented exports.
- [ ] Implement binary envelope parsing and payload validation without file system or UI imports.
- [ ] Encode the passphrase as UTF-8 Uint8Array; implement asynchronous native PBKDF2-HMAC-SHA-256 through react-native-quick-crypto at 600,000 iterations and AES through Expo Crypto AESEncryptionKey.import / aesEncryptAsync / aesDecryptAsync with authenticated metadata. Production salts/nonces use Crypto.getRandomBytesAsync.
- [ ] Verify no passphrase, derived key, or decrypted payload is logged; best-effort overwrite byte buffers after use.
- [ ] Run targeted and full test suites; benchmark PBKDF2 and payload encryption in Node only as preliminary timing, not device evidence.
- [ ] Commit and push the backup format checkpoint.

## Task 4: Write failing tests and implement fail-closed SQLCipher/key lifecycle

**Files:** packages/storage-native/src/secure-database.ts, packages/storage-native/src/migrations.ts, packages/storage-native/test/secure-database.contract.test.ts, apps/mobile/App.tsx.

- [ ] Write injectable contract tests for missing cipher version, missing key with existing DB, missing key with no DB, invalid key encoding, and successful versioned key access.
- [ ] Define the initializer as `openSecureDatabase({ sqlite, secureStore, randomBytes, databaseExists })`; use a fake driver only for unit contracts and record native execution separately.
- [ ] Run tests and verify the expected unavailable or missing-function failures.
- [ ] Implement the native initializer so it queries cipher_version before any pragma key or table access; fail with a visible security error if empty.
- [ ] Use Crypto.getRandomBytesAsync(32), SecureStore, key version metadata, and iOS WHEN_UNLOCKED_THIS_DEVICE_ONLY; do not overwrite an existing database key when the database already exists.
- [ ] Set key using a hex-only raw-key literal and apply transactional schema migrations only after cipher is confirmed.
- [ ] Add a synthetic record and BLOB attachment in one transaction; validate SHA-256 and database integrity after writes.
- [ ] Add diagnostics for cipher version, key retrieval, record persistence, and attachment hash. Never display key bytes or financial data.
- [ ] Run unit tests, typecheck, and web preview; verify preview cannot invoke native or import actions.
- [ ] Commit and push the fail-closed storage checkpoint.

## Task 5: Stage, restore, and recover without replacing live data early

**Files:** packages/backup/src/restore.ts, packages/backup/test/restore.test.ts, packages/storage-native/src/restore-journal.ts, packages/storage-native/test/restore-journal.test.ts.

- [ ] Write restore state-machine tests first for invalid passphrase, invalid schema, attachment checksum mismatch, failure before promotion, crash at each journal phase, and preservation of existing logical records.
- [ ] Run targeted tests and verify they fail for missing restore behavior.
- [ ] Implement header/KDF bounds, authenticate before JSON parsing, validate payload and BLOB hashes, create a new staging SQLCipher database with a newly generated key, and run a full integrity/readback check.
- [ ] Write and fsync a redacted restore journal before atomic same-directory promotion; preserve the old DB until the new DB is reopened and validated.
- [ ] On restart, either finish a validated promotion or restore the prior DB; reject unsupported format/schema without touching live data.
- [ ] Ensure export writes only the encrypted final backup file; restore writes no decrypted plaintext file. Search caches/temp directories after tests for the synthetic plaintext marker.
- [ ] Run targeted tests and verify all fail-closed and preservation cases pass.
- [ ] Commit and push the restore checkpoint.

## Task 6: Build and exercise native iOS and Android development builds

**Files:** app.config.ts, apps/mobile/App.tsx, scripts/verify-native-db.sh, docs/security/native-proof-results.md.

- [ ] Create and boot an iOS simulator and Android emulator; record model/runtime/API level. State clearly that these are simulators/emulators, not physical devices.
- [ ] Build with Expo prebuild and native development builds; do not launch Expo Go. Verify SQLCipher config plugin output in generated native projects.
- [ ] On each target, run cipher-version, SecureStore key retrieval, synthetic record write/read, and synthetic attachment BLOB hash checks.
- [ ] Force-stop and relaunch both apps; confirm the same record and key-version metadata remain usable.
- [ ] Copy the encrypted DB from each app sandbox to the host and use ordinary sqlite3 to confirm schema enumeration fails. Test a wrong-key open using a separate copied DB file and assert failure.
- [ ] Build a negative variant with SQLCipher config disabled and verify the app shows a fail-closed error before creating or reading any record. Check the sandbox for no plaintext DB.
- [ ] Run cross-platform backup tests: export on iOS/import on Android, then export on Android/import on iOS. Use only synthetic records and synthetic attachment bytes.
- [ ] Test wrong passphrase, changed metadata, changed ciphertext, truncation, fresh-install restore, failed restore with old-data preservation, and final file/temp scan on both targets.
- [ ] Record simulator/emulator versus physical-device coverage, package versions, DB artifacts inspected, actual PBKDF2 wall-clock measurements, and any failures. Mark unavailable physical-device/security behavior pending.
- [ ] Run npm audit --omit=dev and inspect output; report advisories without suppressing them. Inspect native manifests and bundle dependencies for network/update/analytics services.
- [ ] Commit and push native evidence and reports. Stop after this slice; do not start the bookkeeping MVP without a new approved task.

## Completion review

- Confirm every claim in native-proof-results.md is supported by executed output or marked pending.
- Review the final diff and staged paths; confirm only synthetic fixtures, docs, source, tests, app configuration, and lockfiles are present.
- Run the required domain/backup tests and typecheck; record native tests separately.
- Push the latest commit and verify local HEAD equals origin/feature/native-security-backup-poc-20261030, upstream is correct, and the worktree has no unexplained untracked files.
- Report recommendation to proceed or revise; do not merge to main.
