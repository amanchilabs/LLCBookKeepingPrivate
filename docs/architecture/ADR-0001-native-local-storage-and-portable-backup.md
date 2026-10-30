# ADR-0001: Native Local Storage and Portable Backup

- Status: approved architecture direction; iOS Simulator and Android emulator SQLCipher/in-memory backup proofs passed. iOS-to-Android file restore passed on simulators/emulator, including Android reinstall; Android-to-iOS restore, physical-device behavior, and full compatibility remain pending.
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
- Keep `packages/domain` independent of Expo, SQLite, and UI. It owns exact cents parsing, strict business-date and simple-interest policies, and balanced-journal validation. Guaranteed-payment obligations, actual payments, book postings, and CPA adjustments remain distinct future domain records; this proof does not post them.
- `packages/storage-native` owns SQLCipher, SecureStore, and the synthetic BLOB fixture. `packages/backup` owns a byte-level portable container and user-initiated file exchange. `App.tsx` selects a synthetic web preview or native diagnostics screen. The browser preview has no record intake, write, or persistence path.
- `.node-version` pins local tooling to Node 24.22.2 because SDK 58, React Native 0.88, and Vitest 5 reject Node 25. The project does not bundle Node.
- The proof slice implements only a synthetic security/backup diagnostics screen, a record with one BLOB, a small pure-domain example, and a logical-record backup proof. It does not implement member books or tax mappings.

### Database and native key lifecycle

- Use `expo-sqlite` with its `useSQLCipher` config plugin set to true in native builds. Expo documents that SQLCipher is unavailable in Expo Go and that an unrecognized `PRAGMA key` can silently have no effect; therefore the application must query `PRAGMA cipher_version` before keying or accessing any data and fail closed if the result is absent.
- Generate a 32-byte database key using `Crypto.getRandomBytesAsync(32)`, encode it as lowercase hex for the SQLCipher raw-key form, and store it in `expo-secure-store`. Do not use `Math.random` or synchronous Expo random bytes for key material.
- On iOS, request `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. On Android, SecureStore uses encrypted SharedPreferences backed by Android Keystore. Store only the small database key and versioned key metadata there, never business records.
- The implementation stores the database in an app-private `LLCBookKeepingPrivate` directory under the document directory. Before creating a key, it checks whether the named database exists. A missing key for an existing database fails closed rather than generating a replacement. It then checks `cipher_version`, applies the raw key, and reads the schema to force key validation before exposing the handle. `PRAGMA temp_store = MEMORY`, WAL/journal behavior, and actual artifacts remain to be verified.
- Android generated config sets `allowBackup: false`; this limits normal OS backup/restore but does not yet establish behavior for every device-transfer path. The iOS database directory does not yet have a verified backup-exclusion attribute. Until that is addressed and tested, do not claim OS backup exclusion on iOS. The `WHEN_UNLOCKED_THIS_DEVICE_ONLY` key is not a portable recovery mechanism.
- Device key loss is not recoverable from the device alone. Recovery is through the independent encrypted backup passphrase. The local database key is never included in backup plaintext or ciphertext payload records.

### Attachments

For this proof, store one synthetic attachment byte array in a BLOB column in the SQLCipher database. A production attachment record would also need a generated identifier, MIME type, size, SHA-256, source transaction, thumbnail policy, and atomic metadata updates. This avoids a second long-lived file-key lifecycle and makes the portable logical backup include attachments without absolute paths.

This choice has costs: database and backup growth, larger SQLite page/WAL churn, memory copies, slower restore, and no secure-erasure guarantee after a row is deleted. Before full receipt support, benchmark realistic PDFs and images. If BLOB storage is too costly, replace it only with a separately reviewed per-file AEAD design, including wrapped keys, unique nonces, streaming/size limits, and crash-safe replacement.

The proof never imports a real receipt. Preview mode has no attachment picker. For future native import, read a user-selected URI without creating a persistent plaintext cache copy where supported; otherwise delete the app-created staging copy in `finally` and report that OS/provider copies are outside app control. Thumbnails are generated in memory and stored only as encrypted DB BLOBs. Sharing/export creates plaintext outside the encrypted database only after a user action; cleanup is best-effort and cannot guarantee deletion from the destination app, share sheet, filesystem snapshots, or backups.

### Portable encrypted backup

Selected libraries:

- `expo-crypto` performs AES-256-GCM on iOS and Android native builds and accepts a caller-supplied nonce and AAD. The web implementation is not used for preview records or backup actions.
- `react-native-quick-crypto` 1.1.9 performs callback-based PBKDF2-HMAC-SHA-256 through native OpenSSL. It requires Nitro Modules and the New Architecture; the current Expo/RN config enables the native architecture. A simulator performance result and platform package build are still required.
- `expo-crypto` asynchronous native random bytes supplies salts and nonces. No cryptographic primitive is handwritten.

Proof format version 1 is a bounded single-buffer format, not yet a release format. It is binary rather than JSON-header based:

1. Bytes 0–7 are ASCII `LLCBKUP` followed by NUL. Bytes 8–11 are format version `1`, KDF ID `1` (PBKDF2-HMAC-SHA-256), cipher ID `1` (AES-256-GCM), and reserved zero. Bytes 12–15 are the big-endian iteration count. Bytes 16–17 are big-endian salt length; bytes 18 and 19 are nonce and tag lengths; bytes 20–23 are big-endian ciphertext length including the tag. Then come the 16-byte salt, 12-byte nonce, and ciphertext with 16-byte tag.
2. AAD is the exact 52-byte prefix: the fixed 24-byte header, salt, and nonce. Parser bounds require the exact version/algorithms/iteration count/lengths, exact total size, and an 8 MiB complete-file maximum before KDF work.
3. Passphrase encoding is its UTF-8 bytes exactly (no trimming or normalization), minimum 12 JavaScript characters. A fresh 16-byte CSPRNG salt and 12-byte CSPRNG GCM nonce are generated for every backup using Expo Crypto. Native Quick Crypto PBKDF2 uses HMAC-SHA-256, 600,000 iterations, and a 32-byte derived key. Benchmark this work factor on physical hardware before release.
4. AES-GCM uses a 128-bit tag. Wrong passphrases, altered metadata, ciphertext tampering, and truncation must fail authentication or structural validation before a restore writer runs.
5. The synthetic proof payload is a UTF-8 JSON record containing one record and a hex-encoded attachment fixture. This is a proof-only serializer, not the V1 data schema; no local SecureStore key, absolute path, or executable content is included. Full backup must add schema-versioned table allowlists, attachment hashes, migrations, and size limits.
6. Export writes only encrypted bytes to an app-cache file and invokes the native system share sheet after user action. Restore uses the native document picker, reads only the encrypted artifact into cache, and decrypts in memory. App-created encrypted cache files are deleted in `finally`; plaintext buffers are zeroed best-effort. Share destinations, provider caches, crash snapshots, and runtime memory are outside that deletion guarantee. Production restore staging/swap journaling is not implemented by this proof.

The portable format contains logical data, not the device-keyed SQLCipher file. A restore therefore needs only the backup file and passphrase, creates a fresh local SQLCipher key in SecureStore, and rebuilds database rows. An iOS-created file was restored and read back on an Android API 36 emulator, including after reinstalling the Android development build. The reverse Android-to-iOS direction is pending because the iOS Simulator Files provider did not expose the downloaded file. Full cross-platform interoperability is not claimed.

The iOS Simulator and Android API 36 emulator native development builds passed SQLCipher 4.17.0 detection, SecureStore key persistence, encrypted record/BLOB reopen, wrong-key rejection, host SQLite refusal, process restart, and in-memory backup authentication/restore/preservation checks. The Android first Gradle build stopped with `No space left on device`, but a retry built, installed, and passed the emulator checks. An iOS-created portable file also restored and was read back on Android, including after an Android app reinstall. Android-to-iOS file restore and physical-device behavior remain pending. See [native proof results](../security/native-proof-results.md) for the dated result matrix.

Production data may exceed the proof's memory limits. Before release, either establish safe, tested limits or design a chunked authenticated format with independent per-chunk nonces, authenticated ordering, truncation detection, and bounded memory. Do not silently raise the 8 MiB limit.

### Precision and domain boundary

- Persist posted USD amounts as signed integer cents. Parse user decimal strings with a cloned `decimal.js` constructor configured for 40 significant digits and `ROUND_HALF_UP`; never convert a financial amount through JavaScript `Number`.
- The pure loan proof supports `ACT/365 Fixed` (actual days divided by 365) and `ACT/ACT calendar year` (split intervals at year boundaries, denominator 365 or 366 for each year). Dates are strict `YYYY-MM-DD` business dates, not timestamps or local-time `Date` values.
- For each date, apply principal repayments first and advances second, then accrue simple interest over the following half-open date interval. Thus an advance date is included in accrual and a repayment date is excluded from the paid-down principal's accrual. Same-day behavior is explicit and tested. No compounding is performed.
- Keep interest at 40-significant-digit decimal precision through segment accumulation. Round only when producing a currency amount or posting/payment allocation, using half-up to cents. The proof domain includes a pure amount parser and deterministic simple-interest function. The domain package has no Expo, persistence, current-time, or UI imports.
- The proof's loan policy is an accounting-engine test only; it does not select a contractual rate, compute tax treatment, or assert deductibility.

### Restore, migration, and failure handling

The bullets below describe the production target strategy, not completed implementation. This proof only parses the bounded proof payload, creates a separate encrypted database with a new local key, writes rows, reopens that database, and reads back each record and attachment. It does not replace an active books database, implement a durable restore journal, or validate a production migration/recovery flow.

- All schema migrations have ordered identifiers and execute in a transaction after SQLCipher/key verification. A migration failure leaves the source database untouched and records only a redacted audit event.
- Restore validates header bounds before KDF work, validates the GCM tag before payload parsing, validates schema and attachment hashes before staging, and writes to a separately named encrypted staging database protected by a newly generated key.
- A durable restore journal records phases: `staging_created`, `staging_validated`, `old_database_parked`, and `new_database_promoted`. On startup, recovery completes promotion only if the staged encrypted database passes keying, schema, and integrity checks; otherwise it restores the parked database. The active database is not deleted until promotion succeeds.
- The proof must test failed restore preservation and restart recovery at each phase. The journal contains identifiers and phase only, not passphrases, keys, financial values, or attachment text.
- Restore and migration output must never fall back to plaintext. Unsupported format/schema versions are rejected without touching current records.

### OS backup and device transfer

- Use the user-initiated encrypted backup as the supported recovery path. Android generated config sets `allowBackup: false`; exact device transfer behavior remains unverified. iOS currently has no custom exclusion on `LLCBookKeepingPrivate`, so its OS backup/transfer behavior is unresolved and the database may be backed up without its this-device-only key. Add and verify the iOS backup-exclusion attribute before production persistence. Exact physical-device behavior remains a release gate.
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
- Does native Quick Crypto PBKDF2 build and produce compatible output on both iOS and Android development builds? What are its installed OpenSSL/Nitro versions, measured latency, and dependency security review results?
- Can the 8 MiB proof format evolve to large encrypted backups without plaintext files and without unacceptable memory pressure? It is not yet a release format.
- Do app-private BLOBs perform acceptably for real receipt sizes, thumbnail generation, database compaction, and backup/restore time?
- Exact iOS backup exclusion, Android data-extraction rules, file protection, crash/log redaction, memory cleanup, biometric/PIN behavior, and device transfer must be verified on physical devices.
- App Store privacy disclosures, export-control questions, and encryption declarations require review against the actual release build. No registration, exemption, tax correctness, or legal compliance is assumed.
- `npm audit --omit=dev` reports 8 transitive dependency advisories (5 low, 3 high), including `deepmerge` prototype poisoning and Zod memory-exhaustion reports through Expo config/CLI paths. The forced audit fix would downgrade Expo to 51; resolve through a compatible SDK update and assess binary reachability before release.
- The first Android Gradle build exhausted the available disk while indexing native headers; a retry succeeded and emulator proofs passed. SQLCipher-disabled failure behavior, cross-platform backup compatibility, and offline behavior remain unverified.

## Evidence links

- Expo SQLite / SQLCipher: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo Crypto AES-GCM and random bytes: https://docs.expo.dev/versions/latest/sdk/crypto/
- Expo Web: https://docs.expo.dev/workflow/web/
- SQLCipher design: https://www.zetetic.net/sqlcipher/design/
- React Native Quick Crypto setup: https://margelo.github.io/react-native-quick-crypto/docs/introduction/complete-setup
- React Native Quick Crypto PBKDF2: https://margelo.github.io/react-native-quick-crypto/docs/api/pbkdf2
- React Native Quick Crypto releases: https://github.com/margelo/react-native-quick-crypto/releases
- OWASP password-storage guidance: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
