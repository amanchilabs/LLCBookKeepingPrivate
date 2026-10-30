# Encrypted database restore state machine

Status: implemented for the synthetic proof database; application storage access now uses a shared gate and scoped leases. Native process-kill validation is pending. This is not a production financial database restore certification.

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

- Ordinary active-database operations use `withActiveDatabase`, a shared coordinator, and callback-scoped leases. Restore and startup recovery take the exclusive barrier, stop new operations, drain admitted operations, close registered handles, validate one active generation, and only then reopen access. Raw SQLite opening is confined to storage/catalog/restore internals.
- This barrier is unit-tested, including started statements, stale lease rejection, concurrent operation draining, key-error locking, and retry. Actual native concurrent save/read/export/attachment operations during restore have not been exercised on the current source SHA.
- Database, catalog, WAL, SHM, and rollback-journal files live inside the app-private database directory. The generation activation avoids renaming an open main database file. WAL is checkpointed and journal mode is set to DELETE before candidate close and cleanup.
- Earlier report evidence described ten simulator-injected exceptions, but did not preserve the exact tested source SHA. It is historical and is not evidence for current source SHA `78cf3096e17e7b3a531b1ccd3c4032cb948f97ad`. A controlled external process-kill harness, new-process recovery checks, and recovery-retry interruptions remain pending.
- If app termination occurs while SQLite itself is committing a transaction, recovery relies on SQLite's transaction journal. This behavior still needs device and power-loss testing.

## File and plaintext handling

- Import sets `copyToCacheDirectory: false`, checks provider-reported size and file size against the 8 MiB bound before reading, then reads the encrypted artifact. It never deletes the user-selected source URI.
- Decrypted payload bytes remain in memory and are zero-filled in `finally` paths. JavaScript strings and native crypto internals cannot be reliably zeroized; that limitation remains.
- Export writes only the encrypted envelope into app cache and asks the OS share sheet to share that encrypted file. The app deletes its cache file after `shareAsync` resolves. Recipient timing and provider-specific copies have not been audited.
- No plaintext receipt, database export, or decrypted backup temp file is intentionally written by this proof path. A full filesystem/forensics scan is still pending.

## Failure-injection results

- Pure TypeScript coordinator tests passed at the current tested source SHA and assert barrier ordering and lease behavior. They do not simulate an OS process termination.
- Native exception-injection evidence is historical without a verified source SHA and is not credited to the current build.
- Current-branch Android and iOS debug builds passed. No native storage/restore proof screen was completed: the shared Android emulator was concurrently used by another app, and the iOS simulator/Metro launch encountered host `ENOSPC`. No current native recovery result is claimed.
