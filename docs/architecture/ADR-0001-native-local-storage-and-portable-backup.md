# ADR-0001: Native Local Storage and Portable Backup

- Status: approved architecture direction; proof and compatibility remain pending.
- Date: 2026-10-30.
- Scope: the first native storage, attachment, and encrypted-backup validation slice only.
- Repository: `veerrajuamanchi/LLCBookKeepingPrivate` is public. Do not put secrets or real financial records in it.

## Context and non-goals

LLCBookKeepingPrivate is a local-first bookkeeping and CPA-workpaper application for one U.S. multi-member LLC. The first deliverable proves a native encrypted database, key lifecycle, encrypted attachment persistence, and portable user-passphrase backup/restore. It is not the bookkeeping MVP, a tax-preparation product, a security certification, or a production-readiness claim.

The localhost Expo Web target is a synthetic-data UI preview only. It must show this exact message:

> Synthetic-data preview. Native encryption, secure key storage, and device-security behavior are not validated in this browser.

The preview must not expose CSV import, receipt selection, backup restore, or real financial entry paths. It will use fixed synthetic display data and no persistence. Browser tests cover presentation only; they do not establish native storage or security behavior.

## Decisions

### Application structure

- Use Expo SDK 58, React Native, and TypeScript for one iOS/Android application, with Expo Web retained only for local synthetic UI review.
- Keep `packages/domain` independent of Expo, SQLite, and UI. It owns decimal parsing, money values, calendar-date values, loan simple-interest policies, balanced journal validation, and deterministic report calculations.
- Keep platform storage behind interfaces. `packages/storage-native` owns SQLCipher, SecureStore, migrations, and native attachment BLOBs. `packages/backup` owns a byte-level, platform-neutral encrypted backup container. `apps/mobile` owns screens and native wiring. `apps/web-preview` behavior is selected by platform guards and contains no data import or persistence.
- The proof slice implements only a synthetic security/backup diagnostics screen, the smallest database fixture, an encrypted attachment fixture, and a small pure-domain example. It does not implement member books or tax mappings.

### Database and native key lifecycle

- Use `expo-sqlite` with its `useSQLCipher` config plugin set to true in native builds. Expo documents that SQLCipher is unavailable in Expo Go and that an unrecognized `PRAGMA key` can silently have no effect; therefore the application must query `PRAGMA cipher_version` before keying or accessing any data and fail closed if the result is absent.
- Generate a 32-byte database key using `Crypto.getRandomBytesAsync(32)`, encode it as lowercase hex for the SQLCipher raw-key form, and store it in `expo-secure-store`. Do not use `Math.random` or synchronous Expo random bytes for key material.
- On iOS, request `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. On Android, SecureStore uses encrypted SharedPreferences backed by Android Keystore. Store only the small database key and versioned key metadata there, never business records.
- Open order: open an empty native SQLite handle; verify `cipher_version`; retrieve or create the key only if no existing database is present; apply the raw key; run a schema read and integrity query; then allow repositories to read or write. If a database exists and its key is missing, reject startup and offer restore. Never create a replacement key for an existing database and never fall back to plaintext SQLite.
- Use one encrypted database file for the proof. Keep `PRAGMA temp_store = MEMORY` for the proof and test the actual resulting database, WAL, and journal artifacts. SQLCipher documents encryption for database pages and journal/WAL pages, but build-specific behavior and temporary files still require inspection.
- Device key loss is not recoverable from the device alone. Recovery is through the independent encrypted backup passphrase. The local database key is never included in backup plaintext or ciphertext payload records.

### Attachments

For this proof, store attachment bytes and thumbnail bytes as BLOB rows in the SQLCipher database, with MIME type, generated identifier, size, SHA-256, and source transaction identifier in metadata. This avoids a second long-lived file-key lifecycle and makes attachment writes transactional with metadata. It also makes the portable logical backup include attachments without absolute paths.

This choice has costs: database and backup growth, larger SQLite page/WAL churn, memory copies, slower restore, and no secure-erasure guarantee after a row is deleted. Before full receipt support, benchmark realistic PDFs and images. If BLOB storage is too costly, replace it only with a separately reviewed per-file AEAD design, including wrapped keys, unique nonces, streaming/size limits, and crash-safe replacement.

The proof never imports a real receipt. Preview mode has no attachment picker. For future native import, read a user-selected URI without creating a persistent plaintext cache copy where supported; otherwise delete the app-created staging copy in `finally` and report that OS/provider copies are outside app control. Thumbnails are generated in memory and stored only as encrypted DB BLOBs. Sharing/export creates plaintext outside the encrypted database only after a user action; cleanup is best-effort and cannot guarantee deletion from the destination app, share sheet, filesystem snapshots, or backups.

### Portable encrypted backup

Selected libraries:

- `expo-crypto` performs AES-256-GCM on iOS, Android, and Web and accepts a caller-supplied nonce and AAD.
- `@noble/hashes` performs asynchronous PBKDF2-HMAC-SHA-256 on the supported JavaScript runtimes. The proof uses the same library and byte inputs on both native targets.
- `expo-crypto` asynchronous native random bytes supplies salts and nonces. No cryptographic primitive is handwritten.

Proof format version 1 is a bounded single-buffer format, not yet a release format:

1. Magic bytes `LLCBKUP\0`, a big-endian format version, a big-endian header byte length, UTF-8 JSON header bytes with fixed producer field order, then ciphertext and the 16-byte GCM tag.
2. Header fields, in a fixed producer order: format version; payload schema version; KDF identifier; iteration count; salt encoding/value; cipher identifier; nonce encoding/value; payload encoding; and declared ciphertext length. The parser authenticates the original header bytes rather than reserializing JSON.
3. Passphrase encoding is UTF-8 after Unicode NFC normalization, with no trimming or truncation. A fresh 16-byte CSPRNG salt and 12-byte CSPRNG GCM nonce are generated for every backup. PBKDF2 uses HMAC-SHA-256, 600,000 iterations, and a 32-byte derived key. The work factor is a provisional proof value and must be benchmarked on supported hardware before release.
4. AES-GCM uses a 128-bit tag. AAD is the exact magic, version, header-length, and header byte sequence. Wrong passphrases, modified metadata, ciphertext tampering, and truncation must fail authentication or structural validation before any live data is replaced.
5. The encrypted payload is a schema-versioned UTF-8 JSON document containing logical records and base64 attachment BLOBs with declared lengths and SHA-256 checks. It contains no local SecureStore key, absolute path, or executable content. A strict parser enforces field allowlists and size limits; it treats strings as untrusted data.
6. Proof maximum: 8 MiB per complete backup and 2 MiB per synthetic attachment. Export assembles and encrypts in memory before writing only the encrypted final artifact. Restore decrypts in memory, validates every field and attachment hash, creates a new SQLCipher database with a fresh local key, validates it, then swaps it into place using a durable restore journal. It never writes decrypted backup payload to a temporary plaintext file. Buffer zeroing is best-effort because the JavaScript runtime may retain copies.

The portable format contains logical data, not the device-keyed SQLCipher file. A restore therefore needs only the backup file and passphrase, creates a fresh local SQLCipher key in SecureStore, and rebuilds database rows. Interoperability is not claimed until a backup created by an iOS native build restores on Android and vice versa.

Production data may exceed the proof's memory limits. Before release, either establish safe, tested limits or design a chunked authenticated format with independent per-chunk nonces, authenticated ordering, truncation detection, and bounded memory. Do not silently raise the 8 MiB limit.

### Precision and domain boundary

- Persist posted USD amounts as signed integer cents. Parse user decimal strings with a cloned `decimal.js` constructor configured for 40 significant digits and `ROUND_HALF_UP`; never convert a financial amount through JavaScript `Number`.
- The pure loan proof supports `ACT/365 Fixed` (actual days divided by 365) and `ACT/ACT calendar year` (split intervals at year boundaries, denominator 365 or 366 for each year). Dates are strict `YYYY-MM-DD` business dates, not timestamps or local-time `Date` values.
- For each date, apply principal repayments first and advances second, then accrue simple interest over the following half-open date interval. Thus an advance date is included in accrual and a repayment date is excluded from the paid-down principal's accrual. Same-day behavior is explicit and tested. No compounding is performed.
- Keep interest at 40-significant-digit decimal precision through segment accumulation. Round only when producing a currency amount or posting/payment allocation, using half-up to cents. The proof domain includes a pure amount parser and deterministic simple-interest function. The domain package has no Expo, persistence, current-time, or UI imports.
- The proof's loan policy is an accounting-engine test only; it does not select a contractual rate, compute tax treatment, or assert deductibility.

### Restore, migration, and failure handling

- All schema migrations have ordered identifiers and execute in a transaction after SQLCipher/key verification. A migration failure leaves the source database untouched and records only a redacted audit event.
- Restore validates header bounds before KDF work, validates the GCM tag before payload parsing, validates schema and attachment hashes before staging, and writes to a separately named encrypted staging database protected by a newly generated key.
- A durable restore journal records phases: `staging_created`, `staging_validated`, `old_database_parked`, and `new_database_promoted`. On startup, recovery completes promotion only if the staged encrypted database passes keying, schema, and integrity checks; otherwise it restores the parked database. The active database is not deleted until promotion succeeds.
- The proof must test failed restore preservation and restart recovery at each phase. The journal contains identifiers and phase only, not passphrases, keys, financial values, or attachment text.
- Restore and migration output must never fall back to plaintext. Unsupported format/schema versions are rejected without touching current records.

### OS backup and device transfer

- Use the user-initiated encrypted backup as the recovery path. The local SQLCipher database, attachment BLOBs, and local SecureStore entry should be excluded from automatic OS backup/device transfer so an encrypted DB is not restored without its key.
- Expo SecureStore documents that Android Keystore material is not restored and its config plugin excludes SecureStore preferences from Android Auto Backup. Configure the application to exclude its SQLite directory as well. On iOS, add and verify the platform-specific backup-exclusion attribute for the database directory. Exact native configuration and physical-device behavior remain release gates.
- iOS Keychain items can persist across reinstall with the same bundle identifier; that behavior is not a recovery contract. Android SecureStore values do not survive uninstall. New installs/restores generate a new local key.
- User-initiated backup export creates an encrypted file. User-initiated report/CSV/PDF/share exports may be plaintext and leave the sandbox; disclose destination and cleanup limits. Do not claim all live data or exports are encrypted.

### Network and release configuration

- Runtime has no backend, account, analytics, advertising, crash-reporting, remote-config, bank-feed, payment, or remote-AI service. Do not include `expo-updates` or any OTA update service. Set Expo updates disabled in app config and verify the built dependency tree and native manifest.
- Development builds may connect only to the explicitly local Metro server. Development scripts disable Expo CLI telemetry. Production financial flows must not make HTTP requests; the app has no `fetch`/WebSocket client dependency or network feature in this proof.
- Package installation and native builds require developer-initiated downloads. Those build-time operations are not app runtime services. Release bundle and manifest inspection remains mandatory.
- The source repository is public. Use synthetic fixtures only. No secrets, real financial records, receipts, tokens, private keys, or local databases may enter Git.

## Proof acceptance criteria

- Native development builds, not Expo Go, run on both iOS and Android. Record simulator/emulator versus physical-device status for every result.
- Both platforms report a non-empty `PRAGMA cipher_version`, create/read/write the database across a force-stop/relaunch, and retrieve the same generated key from SecureStore.
- Opening a copied encrypted DB with a wrong key fails; ordinary host SQLite cannot enumerate its schema/data; absence of cipher support causes a visible fail-closed error before any record access.
- Encrypted attachment and metadata commit atomically, persist across restart, and restore with matching size/hash.
- Pure-domain and backup tests cover deterministic outputs, wrong passphrase, altered header, changed ciphertext, truncation, unsupported versions, attachment hash mismatch, fresh-install restore, failed-restore preservation, and cross-platform iOS/Android transfer.
- Inspect native DB, WAL/journal, caches, logs, and backup workflow for plaintext; no claim extends to memory remnants, screenshots, OS/device compromise, or user-exported files.

## Remaining security and compliance questions

- Does the Expo SDK 58 SQLCipher build pass keying and host SQLite inspection on both target architectures, and what SQLCipher/crypto-provider versions are actually linked?
- Does the Expo build disable file-based temporary storage, or can SQLite operations create unencrypted temporary files?
- Does Expo Crypto AES-GCM produce byte-compatible 12-byte nonce/16-byte tag behavior across current iOS and Android native builds with identical AAD?
- Is Noble PBKDF2 performance acceptable on supported low-end physical devices at 600,000 iterations? No physical device is currently available in the inspected environment.
- Can the 8 MiB proof format evolve to large encrypted backups without plaintext files and without unacceptable memory pressure? It is not yet a release format.
- Do app-private BLOBs perform acceptably for real receipt sizes, thumbnail generation, database compaction, and backup/restore time?
- Exact iOS backup exclusion, Android data-extraction rules, file protection, crash/log redaction, memory cleanup, biometric/PIN behavior, and device transfer must be verified on physical devices.
- App Store privacy disclosures, export-control questions, and encryption declarations require review against the actual release build. No registration, exemption, tax correctness, or legal compliance is assumed.

## Evidence links

- Expo SQLite / SQLCipher: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo Crypto AES-GCM and random bytes: https://docs.expo.dev/versions/latest/sdk/crypto/
- Expo Web: https://docs.expo.dev/workflow/web/
- SQLCipher design: https://www.zetetic.net/sqlcipher/design/
- Noble Hashes: https://github.com/paulmillr/noble-hashes
- OWASP password-storage guidance: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
