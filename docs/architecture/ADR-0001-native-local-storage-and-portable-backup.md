# ADR-0001: Native Local Storage and Portable Backup

- Status: validation prototype; production approval pending.
- Updated: 2026-10-30.
- Scope: Expo native storage, attachment persistence, and user-initiated encrypted backup/restore validation only. No bookkeeping MVP.
- Dependency base: prerequisite branch `feature/native-security-backup-poc-20261030` at `8379b710302c9231299363e5a745dc939068d357`; this branch adds restore recovery, negative-build policy, and backup exclusions.

## Decision and boundaries

Use Expo SDK 58, React Native 0.88, and TypeScript for iOS/Android; Expo Web is a synthetic-data layout preview only. The pure `packages/domain` engine owns decimal/date/interest policies and has no Expo, UI, or persistence imports. Native storage, backup format/crypto, and presentation remain separate packages. This validation screen is not the bookkeeping application.

The browser must show: “Synthetic-data preview. Native encryption, secure key storage, and device-security behavior are not validated in this browser.” It does not accept CSVs, receipts, backup files, or real records.

## Dependency choices and scope

Exact direct versions are pinned in `package.json` and `package-lock.json`; the transitive tree and audit evidence are in [the dependency inventory](../security/dependency-inventory.md) and [advisory report](../security/audits/npm-audit-2026-10-30.md).

- `expo-sqlite@58.0.14` with its native SQLCipher build option: local SQLCipher database. It is ordinary SQLite on Web; web financial persistence is disabled.
- `expo-secure-store@58.0.2`: small random local keys through Keychain/Android Keystore-backed storage; it does not store records.
- `expo-crypto@58.0.7`: native CSPRNG and AES-256-GCM.
- `react-native-quick-crypto@1.1.9`: native PBKDF2-HMAC-SHA-256 using bundled OpenSSL/Nitro; new architecture required.
- `expo-file-system@58.0.13`, `expo-document-picker@58.0.4`, and `expo-sharing@58.0.21`: local encrypted file staging, explicit user-selected restore, and user-initiated share handoff. Their broader APIs are not used for background/network transfer.
- `decimal.js@10.6.0`: pure decimal domain arithmetic. React/React Native, Expo, and web runtime versions are pinned as listed in the inventory.

The portable proof uses a bounded, versioned binary envelope: format v2; PBKDF2-HMAC-SHA-256, 600,000 iterations, 32-byte derived key; random 16-byte salt and 12-byte AES-GCM nonce; 128-bit tag; exact header+salt+nonce as authenticated metadata; and 8 MiB maximum. Passphrases are 12–1,024 UTF-8 bytes. Parameters are fixed and rejected if unsupported. KDF benchmarking is proof-only; selection for release must be benchmarked on supported low-end physical devices and reviewed for acceptable latency and offline guessing cost.

No plaintext device key is included in a portable backup. After authenticated decrypt, restore stages a new SQLCipher database with a newly generated SecureStore key. The proof payload is synthetic and is not a production data schema. Prior v1 proof artifacts are intentionally not accepted by v2; migration/interoperability must be designed before any release-format change.

## Database, attachments, and keys

Before any persistent path is opened, storage probes `PRAGMA cipher_version` on a memory-only connection. An absent cipher fails closed. The negative build flag `LLCB_SECURITY_NEGATIVE_SQLITE=1` disables SQLCipher only in a non-production build; combining it with `EAS_BUILD_PROFILE=production` throws. A unit test verifies ordering and rejection. A native negative-build install and filesystem scan remain pending.

The encrypted catalog stores database-generation IDs and an active pointer. Each generation has a random 32-byte SQLCipher key in platform secure storage and a distinct database file. Catalog and data handles are closed before generation activation/deletion; candidate databases use WAL checkpoint truncation followed by DELETE journal mode before close. The catalog uses DELETE journaling and `synchronous=FULL`; activation pointer and recovery journal change together in one transaction. No general write-admission barrier or concurrent multi-window production lifecycle has been proven.

For this proof, a synthetic attachment is a BLOB in the SQLCipher database. This makes the row and its attachment atomic and avoids a separate file key. It increases database/WAL churn and memory pressure; real PDF/image sizing, thumbnail processing, secure deletion, and crash behavior are unvalidated. No real receipt import is enabled. Future user sharing can create plaintext outside the database; cleanup cannot control the share destination or OS/provider copies.

The iOS config plugin marks the app-private `LLCBookKeepingPrivate` directory excluded from backup during launch and fails app launch if that operation fails. The first Xcode compile found and helped fix two generated-Swift type errors; the fixed Swift was regenerated, but a post-fix full build and device observation remain pending because available disk is below the native build requirement. Apple describes the exclusion as guidance rather than a guarantee and notes that file operations can reset the property; the directory approach must be rechecked after each database lifecycle operation. Android config generates `allowBackup=false`, legacy full-backup exclusions, and Android 12+ cloud/device-transfer exclusions; generated XML/manifest were inspected, but current-branch build and OEM transfer behavior are pending. Neither setting makes runtime database files encrypted by itself.

Key access failure is fail-closed: do not generate a replacement key for an existing encrypted database. Recovery is via an independent portable backup, which creates a new local generation/key. iOS Keychain persistence across reinstall and Android uninstall behavior are platform behaviors, not recovery contracts. A biometric/PIN gate is not implemented. A lost/invalid catalog key can prevent reaching the restore path in an existing damaged installation; recovery UX for that case is a blocker before real-data use.

## Restore state machine

1. Bound selected file size and validate fixed envelope fields before PBKDF2.
2. Authenticate/decrypt in memory; parse with fatal UTF-8 and validate record counts, IDs, attachment bounds, and schema version before touching active storage.
3. Create a separate SQLCipher generation using a fresh local key; populate it in a transaction; validate `integrity_check`, `user_version`, counts, and canonical SHA-256 manifest; checkpoint WAL, switch to DELETE journaling, close, and register it.
4. In an encrypted catalog transaction, record `{previous,candidate}` and point active to candidate.
5. Reopen candidate with its new key and repeat schema/integrity/content validation. Clear the journal only after validation; then delete the old inactive generation and its key.
6. At startup, before normal storage access, inspect the journal. A valid candidate completes; an invalid candidate restores the prior pointer and removes the invalid candidate. A disagreement or inaccessible catalog fails closed rather than guessing.

Injected exceptions were exercised at ten native iOS Simulator boundaries. Recovery yielded either the original synthetic row or a complete candidate. These were in-process injected exceptions followed by recovery calls, not OS process kills or power-loss tests. A post-journal orphan can remain after interrupted cleanup; active data remains whole. See [restore state machine and evidence](../security/restore-state-machine.md).

The database and its attachment BLOBs move in one candidate generation. Production separate-file attachments would require a generation-scoped attachment directory or manifest plus its own atomic activation; they are not covered by this proof.

## Network, release, and limitations

Expo updates are disabled; no backend, account, sync, analytics, advertising, crash reporting, remote config, bank, payment, or AI service is configured. Development Metro is local only. Release network permission and linked framework review remain pending. Dependency install/build tools use network when invoked by a developer; this is distinct from app runtime.

This design does not establish that all live data is encrypted: passphrases, decrypted payloads, SQLite working memory, user exports, OS/provider copies, logs, screenshots, and device compromise require separate controls. No absolute-privacy, tax-correctness, legal-compliance, store-disclosure, or production-readiness claim is made.

## Validation status

The current branch has automated restore-protocol and fail-closed ordering tests, and an iOS Simulator exercised the actual SQLCipher catalog/restore implementation, synthetic attachment BLOB, interrupted-restore boundaries, and PBKDF2 benchmark. Android current-branch rebuild/runtime, file-based v2 cross-platform restore in both directions, fresh iOS restore, SQLCipher-disabled native build, no-Metro offline behavior, plaintext artifact audit, iOS exclusion runtime, physical devices, and store/compliance review remain pending. The selected PBKDF2 work factor follows OWASP's 600,000 HMAC-SHA-256 recommendation specifically in its FIPS-related guidance; this does not validate this app's offline-backup threat model or passphrase strength. Full matrix and blockers: [validation report](../security/native-proof-results.md).

## Evidence links

- Expo SQLite/SQLCipher: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo Crypto: https://docs.expo.dev/versions/latest/sdk/crypto/
- Android backup rules: https://developer.android.com/identity/data/autobackup
- Apple backup exclusion: https://developer.apple.com/documentation/foundation/urlresourcekey/isexcludedfrombackupkey
- OWASP password-storage guidance: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
