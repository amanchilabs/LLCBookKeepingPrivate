# Encrypted database restore state machine

Status: implemented for the synthetic proof database; simulator-injected failure checks passed on iOS. It is not a production financial database restore certification.

## State and storage

- The encrypted `llc-database-catalog.db` uses its own random SecureStore key. It stores generation IDs, database filenames, key aliases, the active generation pointer, and at most one restore journal.
- Each database generation is a separate SQLCipher database in the app-private `LLCBookKeepingPrivate` directory. Its 32-byte key is generated for that generation and held under a new SecureStore alias.
- The proof attachment is a BLOB in the same SQLite generation as the record. Database and attachment therefore activate together. No receipt file or separate attachment directory is part of this proof.
- The backup payload authenticates a versioned schema and records with AES-256-GCM. The restored database stores a canonical SHA-256 manifest, row count, and SQLite `user_version`.
- Restore validates the envelope size, version, fixed KDF parameters, GCM tag, JSON encoding, record count, identifier uniqueness, field lengths, per-attachment size, and aggregate attachment size before creating a candidate.

## Transitions

1. **Active original:** existing generation remains selected by the encrypted catalog.
2. **Candidate staging:** create a new generation filename and key alias. Insert all synthetic rows and the content manifest in one SQLite transaction. Check the schema version and `PRAGMA integrity_check`.
3. **Candidate closed:** run `wal_checkpoint(TRUNCATE)`, set journal mode to `DELETE`, and close the candidate connection. Candidate validation reopens it under the new key and checks integrity and manifest hash.
4. **Generation registered:** add candidate ID, filename, and SecureStore alias to the encrypted catalog. At this point the old generation remains active.
5. **Atomic activation:** one `BEGIN IMMEDIATE` transaction with `synchronous=FULL` inserts `{previous,candidate}` into `restore_journal` and changes the active generation pointer. The journal and pointer commit together; a process interruption cannot commit one without the other.
6. **Candidate verification:** reopen through SQLCipher and the candidate SecureStore key; verify `cipher_version`, SQLite integrity, schema version, row count, and canonical content hash.
7. **Activation finalized:** clear the journal in a catalog transaction only after successful verification.
8. **Old generation cleanup:** close registered encrypted database connections, checkpoint, switch journal mode to `DELETE`, delete the old SQLite database through Expo SQLite's database deletion API (including its SQLite-managed sidecars), delete its SecureStore key, and remove its catalog row. A cleanup interruption can leave an inactive orphan; it cannot make that generation active.

## Startup recovery

Before financial storage is exposed, startup reads the encrypted catalog. If no journal exists, the active generation is used. If a journal exists and the active pointer names the candidate, startup reopens and verifies the candidate. A valid candidate is finalized and the old generation is then eligible for cleanup. A candidate that fails verification causes an atomic pointer rollback to the still-preserved original, followed by candidate deletion. If the journal, pointer, or original generation disagree, startup fails closed rather than guessing.

An interruption before activation leaves the old generation active; an incomplete candidate may remain as an inactive orphan. An interruption after journal removal leaves the complete verified candidate active; an old inactive generation may remain if cleanup did not finish. Neither case exposes a partial/mixed record-plus-attachment state.

## Connection and file lifecycle

- The current proof uses short-lived handles and an in-process registry so restore can checkpoint and close them before switching/deleting generations. The current mobile shell has no concurrent ledger writer.
- There is not yet a production-wide transaction gate that blocks arbitrary app callers from opening or writing the active database during restore. A production database manager must own all SQLite handles, serialize writes, drain transactions, and reject writes for the duration of activation. This is an architecture blocker before real financial data.
- Database, catalog, WAL, SHM, and rollback-journal files live inside the app-private database directory. The generation activation avoids renaming an open main database file. WAL is checkpointed and journal mode is set to DELETE before candidate close and cleanup.
- The simulator failure harness throws at named durable boundaries, then invokes the startup recovery path, which closes/reopens SQLite handles and verifies persisted state. It is native SQLite/catalog evidence, but does not forcibly kill the OS process at each boundary. Hard process termination at every checkpoint remains pending.
- If app termination occurs while SQLite itself is committing a transaction, recovery relies on SQLite's transaction journal. This behavior still needs device and power-loss testing.

## File and plaintext handling

- Import sets `copyToCacheDirectory: false`, checks provider-reported size and file size against the 8 MiB bound before reading, then reads the encrypted artifact. It never deletes the user-selected source URI.
- Decrypted payload bytes remain in memory and are zero-filled in `finally` paths. JavaScript strings and native crypto internals cannot be reliably zeroized; that limitation remains.
- Export writes only the encrypted envelope into app cache and asks the OS share sheet to share that encrypted file. The app deletes its cache file after `shareAsync` resolves. Recipient timing and provider-specific copies have not been audited.
- No plaintext receipt, database export, or decrypted backup temp file is intentionally written by this proof path. A full filesystem/forensics scan is still pending.

## Failure-injection results

- Pure TypeScript coordinator tests inject exceptions before and after candidate staging, activation, verification, journal finalization, rollback, and cleanup. They restart the coordinator over durable fake-store state and assert original-or-complete-candidate only.
- iOS Simulator native test executed 10 injected boundaries: after candidate close; after registration; before and after the activation transaction; before and after candidate reopen/verification; before and after journal clear; and before and after old-generation deletion. Every run recovered to the complete original or complete candidate, including BLOB checksum checks. These were native simulator database tests with injected exceptions, not physical-device tests or hard process kills.
- Android native failure injection is pending because this host could not complete the Android build: two attempts failed with `No space left on device`; a subsequent Expo launch attempt also failed its ADB boot/property query. No Android restore result is claimed for this branch.
