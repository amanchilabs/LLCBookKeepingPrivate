# Threat Model Notes — Local Storage and Portable Backup Proof

**Status:** working threat model for a synthetic validation slice, not a security assessment or approval. Last updated 2026-10-30.

## Scope and trust boundaries

In scope: Expo native development app, SQLCipher database and catalog, SecureStore/Keychain/Android Keystore access, local encrypted backup file, user-selected import URI, user-initiated encrypted export, Expo/native dependencies, and the restore-generation state machine. Expo Web is sample-only and has no financial persistence or import path.

Out of scope for protection claims: a compromised/unlocked device, malicious OS or recipient app, screenshots, screen capture, user-shared plaintext outside this proof, platform/provider backups not covered by configured exclusions, memory disclosure, and an attacker with the backup plus a weak/reused passphrase. These remain risks to explain and test; they are not dismissed as impossible.

## Assets

- Synthetic proof records and attachment BLOBs; future books, member payments, loans, and attachments.
- Per-generation random 32-byte SQLCipher key and separate catalog key.
- Backup passphrase, PBKDF2-derived key, random salt, AES-GCM nonce, and authenticated backup bytes.
- Active-generation pointer, previous/candidate recovery journal, schema/data manifest, and restore progress.
- User-selected backup URI and temporary encrypted export file.

## Adversaries and abuse cases

1. **Lost or transferred device / casual filesystem reader.** Reads app-private database files, WAL, backup artifacts, or copied files. SQLCipher protects DB contents when configured and key unavailable; user backup is independently encrypted. Ordinary SQLite negative check passed in prerequisite evidence; current Android build and native negative-build behavior pending. OS backup exclusions are configuration, not a cryptographic boundary.
2. **Malformed, truncated, or tampered backup.** Supplies oversized input, unsupported versions/algorithms, crafted metadata, wrong passphrase, invalid UTF-8/JSON, duplicate IDs, huge attachments, or changed authenticated bytes. Parser enforces 8 MiB envelope, fixed KDF/cipher/version, bounded passphrase and records/attachments; GCM authentication precedes parsing. Automated negative tests cover format and coordinator. Native v2 platform interoperability pending.
3. **Interrupted restore or storage failure.** Stops between candidate write, registration, activation, verification, journal clear, or cleanup. Separate database generation plus atomic catalog pointer+journal transaction and startup recovery aim for original-or-complete-candidate. Ten iOS Simulator exception points passed, but were not hard process kills, OS crashes, power loss, or Android tests. Production concurrent-writer exclusion is missing.
4. **Missing/corrupt local key or catalog.** App refuses to silently create a replacement for an existing encrypted database. A portable backup uses a new generation key, but an already-installed damaged catalog-key path does not yet provide a guided recovery path. Never bypass authentication or delete old data automatically.
5. **Plaintext residue through file picker, SQLite, logs, crash reports, share sheet, or exports.** Current import asks DocumentPicker not to cache-copy and decrypts in memory; export stages encrypted bytes only. JS/native buffers can remain in memory; file/provider/share cleanup is best effort. No forensic audit has established absence of plaintext residues. SQLite temp behavior, logs, crash capture, and future report exports need explicit review.
6. **Malicious or compromised dependency/build plugin.** Expo config/CLI advisory paths are reachable during local build/config processing. Two open npm advisories are documented with specific inputs and reachability in [the audit report](audits/npm-audit-2026-10-30.md). No transaction or receipt is intentionally sent to these build tools. This does not mean the advisories are dismissed; compatible patches are unavailable in the pinned SDK line at snapshot.
7. **Network service or OTA channel.** App config disables updates; no app backend, upload, telemetry, analytics, crash, ad, AI, bank, or payment path is configured. Development Metro is local. Release manifest contains INTERNET until proven otherwise, so no-Metro/external-network-isolated standalone test and binary inspection are pending.
8. **Biometric/key-access failure.** No biometric/PIN app lock exists. SecureStore availability may fail due to device lock, key invalidation, uninstall/reinstall, OS transfer, or hardware policy. The app should fail closed and offer a carefully designed backup restore path; behavior across physical devices is pending.

## Current controls and evidence

- SQLCipher is probed in a memory-only connection before persistent database open. A negative build option is separate from production and rejects the production profile. Automated ordering/config tests pass; native negative build is pending.
- Database keys are random bytes stored through SecureStore; each restore candidate gets a new key. Catalog metadata is not in portable backup.
- Backup format authenticates the fixed header, salt, nonce, and ciphertext with AES-256-GCM. PBKDF2-HMAC-SHA-256 is fixed at 600,000 iterations and 32 output bytes. Salt/nonce use Expo native CSPRNG. Header bounds are checked before KDF. Proof KDF result is iOS Simulator only (median 45.3 ms, p95 53.1 ms, five samples).
- Candidate database and its synthetic attachment BLOB activate as one generation. No separate attachment files exist in this proof.
- iOS exclusion plugin is generated by Expo config, but compiled/runtime validation pending. Android generated cloud/device-transfer exclusions inspected, but built/OEM behavior pending.
- Dependency lockfile and audit JSON are reproducible artifacts; the audit contains reachable Expo config/CLI paths and does not equate npm severity with app exploitability.

## Key management and recovery properties

Local SQLCipher keys are random 32-byte values and reside in platform secure storage under generation-specific aliases. The portable backup passphrase is never persisted; PBKDF2 output is imported to native AES and byte buffers are cleared best effort. The portable backup intentionally rebuilds a database and generates a new local key, so cross-device recovery does not require the source device key. Recovery from an unavailable local catalog key on an existing install has not been implemented. Passphrase loss means the encrypted backup cannot be restored; no recovery server or escrow exists.

Passphrase policy is a minimum of 12 characters and max 1,024 UTF-8 bytes. This is only an input bound, not a strength guarantee. No user-facing strength guidance or rate limiting is implemented. Since an attacker can copy the backup and guess offline, a physical-device latency and threat-informed work-factor decision is required before release; the current 600,000 iterations are provisional and may be too low or too slow depending on targets.

## Open security questions

- Does SQLCipher get linked and fail closed in every release architecture and negative native build?
- Does SQLite create plaintext temp files in any operation, and what file-protection class applies to DB/WAL/journal/cache?
- Can the current restore coordinator serialize all future readers/writers and survive actual process kill, low storage, migration failure, and power interruption?
- Does v2 produce byte-compatible AES-GCM/PBKDF output on real iOS and Android targets, including files exported/imported through OS providers?
- Do OS backup exclusions work on actual supported iOS versions and Android OEM device-transfer paths?
- Can users recover safely if catalog metadata/key is inaccessible without destroying potentially recoverable old data?
- What are the exact OpenSSL/Nitro/native crypto versions in produced binaries, and are dependencies maintained and licensed appropriately?
- What store disclosures and export-control obligations apply to the final binary and jurisdictions? This is pending review; no conclusion is asserted.

## Required before real-data use

1. Complete current-format native file restore both directions and fresh-install restore on both platforms.
2. Build/test SQLCipher-disabled native configuration; show no persistent plaintext database is created.
3. Validate on physical supported devices, including lost-key behavior and documented recovery.
4. Enforce a single database manager that drains writes and owns all SQLite handles during restore; inject actual process termination at durable transitions.
5. Complete plaintext artifact/log/export/share audit and verify iOS/Android backup behavior in installed builds.
6. Resolve or formally mitigate dependency advisories with compatible regression evidence.
7. Run standalone no-Metro/offline build and inspect release permissions, update configuration, linked crypto, and privacy disclosures.
