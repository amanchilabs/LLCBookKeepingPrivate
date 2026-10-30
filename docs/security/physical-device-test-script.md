# Physical-device security test script

Use only synthetic records and byte fixtures. Install a native development build, not Expo Go. Record device model, OS version, build SHA, app/config version, and whether each check passed. Do not use real books until the real-data gate below is signed off.

## iOS and Android local database

1. Install fresh, run the storage proof, and record the SQLCipher version and generated key alias (never the key). Confirm the synthetic row and BLOB survive app force-quit/relaunch.
2. Run wrong-key rejection. Copy the app database only to a controlled test host and confirm ordinary SQLite cannot read the schema or record.
3. Install a separate SQLCipher-disabled negative build. Start storage and confirm an explicit error occurs before any persistent database file is created; inspect app-private storage for database, WAL, SHM, and journal files. Confirm the production profile cannot produce this build.
4. Lock/unlock the device, restart it, and test the app while locked and after unlock. Record SecureStore/Keychain access behavior. No credential or key values belong in logs.

## Portable backup and interrupted restore

1. On each platform, export a v2 encrypted backup through the OS share UI and retain the exact artifact in a controlled test directory. Confirm it is not plaintext and record its hash/length.
2. Test correct passphrase, wrong passphrase, modified header, changed ciphertext, truncation, oversized file, unsupported version, and malformed payload. Every negative input must be rejected before activation.
3. Restore iOS-produced file on Android and Android-produced file on iOS. Repeat fresh-install restore on both platforms. Verify the synthetic record and attachment hash after force-quit/relaunch; confirm a new local device key is used.
4. Repeat the crypto/format tests independently of the picker, then test the user-facing picker separately. Report provider/picker failures as UX failures, not cryptographic incompatibility.
5. Inject failure after candidate close, registration, activation transaction, candidate reopen/validation, journal clear, and old-generation deletion. Also forcibly terminate the process at each durable transition. After each restart, require the whole original or whole validated candidate; verify no mixed record/attachment state and confirm cleanup eventually removes inactive generations.
6. Make a valid backup, begin restore over synthetic existing data, and deliberately trigger storage-full, migration/schema rejection, and corrupted-candidate failures. Existing active data must stay readable after each failed restore.

## Offline, backup, temporary files, and performance

1. Install a standalone build, stop Metro, disable Wi-Fi/cellular and other external networking, restart the device, and use all financial-local paths plus backup restore. No runtime request or OTA dependency may be needed.
2. Inspect app-private database, WAL/SHM/journal, caches, temp directories, crash/log output, and exports before/during/after import and export. Decrypted payloads must not be left in plaintext files. Inspect the OS share destination separately and document copies the app cannot erase.
3. Verify iOS backup exclusion after creating/checkpointing/reopening the DB and after OS backup/restore. Verify Android cloud backup and device-to-device transfer are excluded on each supported API/OEM path.
4. Run five or more PBKDF2 samples on the lowest supported physical device. Record median, p95, memory, OS and device. Release gate: at least 600,000 HMAC-SHA-256 iterations and p95 at or below one second on every supported device; if unmet, revise the vetted design, do not lower iterations without security review.

## Results required before real financial data

- Both platform SQLCipher-enabled builds and the SQLCipher-disabled fail-closed build pass on physical supported devices.
- Both cross-platform v2 restore directions and both fresh-install restore flows pass using actual files, correct/wrong passphrases, and attachment checks.
- Forced process termination and storage-full restore tests always recover a whole original or whole validated candidate.
- Platform key behavior, app lock/recovery experience, OS backup exclusions, offline operation, KDF limits, and plaintext artifact/log/sharing review are documented with passing evidence.
- No unresolved architecture blocker remains for the storage/catalog key recovery path or concurrent database writers.
