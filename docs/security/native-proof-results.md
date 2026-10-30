# Native Security and Backup Proof Results

Status: incomplete. iOS simulator proof passed for SQLCipher storage and an in-memory native backup round-trip. Android native runtime, file-based restore, cross-platform restore, physical-device behavior, and production release controls remain unverified. Do not start the full MVP or claim production readiness from these results.

Test date: 2026-10-30.

## Environment

- iOS: Xcode 26.6, iOS 26.5 runtime, iPhone 17 Simulator, Expo development build. No physical iPhone was available.
- Android: API 36 Pixel 8 AVD booted using Android Emulator 37.2.13, then the first Gradle native build failed while writing Gradle's file-hash cache with `No space left on device`. The app was not installed on the emulator. No physical Android device was available.
- The failed Android attempt had 124 MiB free at the failure point. The cleanup command for task-installed Android SDK and AVD files was rejected by the environment's file-deletion guard; the SDK/AVD remain local and outside Git. The repository's generated `android/` project is ignored.
- The configured public remote is `https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git`. All fixture data is synthetic.

## Result matrix

| Capability | iOS native development build | Android native development build | Evidence / limitation |
| --- | --- | --- | --- |
| SQLCipher version reported before schema access | PASS: 4.17.0 community | Pending | App proof screen queried `PRAGMA cipher_version`. |
| Generated database key stored and retrieved through SecureStore | PASS | Pending | 32 random bytes; key persisted and re-read through SecureStore. |
| Database and synthetic attachment survive close/reopen | PASS | Pending | Synthetic note and BLOB read back from SQLCipher database. |
| Data survives application process restart | PASS | Pending | iOS app was stopped, relaunched, and the same database record was read again. |
| Incorrect key cannot read the database | PASS | Pending | A separate connection with a random incorrect 32-byte key failed schema access. |
| Ordinary host SQLite cannot read encrypted database | PASS | Pending | Host `sqlite3` against the simulator database returned `file is not a database (26)`. |
| Build without SQLCipher fails closed before data access | Pending | Pending | Config supports a negative build switch; no native negative build was completed. |
| Native backup encryption and in-memory decrypt | PASS | Pending | Uses Expo Crypto AES-256-GCM and Quick Crypto PBKDF2-HMAC-SHA-256, 600,000 iterations. |
| Wrong passphrase, ciphertext tampering, truncation rejected | PASS | Pending | iOS native proof checked each rejection. |
| New local key generated for restore | PASS | Pending | In-memory restore generated a SecureStore key different from the source database key. |
| Synthetic database row and attachment restored and reopened | PASS | Pending | Restored into a separate SQLCipher database and read back. |
| Failed restore preserves an existing target and source data | PASS | Pending | A synthetic sentinel remained readable after wrong-password, tampering, and truncation attempts; source row was re-read. |
| Fresh-install restore from an exported backup file | Pending | Pending | Document-picker/share-sheet workflow was not exercised end to end. |
| iOS-created backup restored on Android | Pending | Pending | No Android build/runtime. |
| Android-created backup restored on iOS | Pending | Pending | No Android build/runtime. |
| No unrecovered plaintext temporary files | Pending | Pending | Code keeps decrypted payload in memory and deletes app-created cache files in `finally`; filesystem/provider cleanup was not audited. |
| PBKDF2 wall-clock and peak-memory benchmark | Pending | Pending | Work-factor benchmark remains required on physical devices before release. |
| Airplane-mode / external-network-disabled operation | Pending | Pending | No isolated-network test was run. |

## Checks actually run

- `npm run test`: 12 passing tests total: 2 synthetic-preview tests, 8 pure-domain tests, 2 backup-format tests.
- `npm run typecheck`: passed.
- `npm run doctor` / `npx expo install --check`: passed; pinned Expo package versions match SDK 58.
- `npm run config:public`: passed; SQLCipher enabled, updates disabled, Android `allowBackup` false.
- iOS `build_run_sim`: development build succeeded and app launched on the iPhone 17 Simulator. Xcode reported third-party warnings; no build errors.
- iOS native storage proof: passed SQLCipher version, SecureStore key, database reopen, record/BLOB persistence, wrong-key rejection.
- iOS process restart: stopped and relaunched the development app, then repeated the proof against the existing database successfully.
- Host SQLite inspection of the simulator database: expected failure, exit code 26, `file is not a database`.
- iOS native in-memory backup proof: all seven result flags passed: wrong passphrase, tampering, truncation, fresh local key, restored DB reopened, attachment restored, failure preservation.
- Browser preview Playwright check at 1440×1050 and 390×844: exact required notice visible; member navigation and sample-only transaction notice worked; no file or free-text intake controls; no horizontal viewport overflow; no page errors.
- Android: emulator boot succeeded; Expo/Gradle build failed before app install with `No space left on device` while writing `~/.gradle/caches/9.4.1/fileHashes/fileHashes.bin`. This is not an Android app or SQLCipher test result.

## Recommendation and remaining gates

Revise/continue this validation slice before implementation of the bookkeeping MVP. First recover disk space and complete Android native build and runtime proofs. Then complete the SQLCipher-disabled fail-closed build, file-based fresh-install restore, both cross-platform restore directions, temporary-file scan, and a measured KDF benchmark. Physical-device behavior, OS backup exclusions/transfers, file protection, local-network-disabled operation, store privacy disclosures, and encryption export review remain release gates. Do not claim compatibility or production readiness until those checks are completed and reviewed.
