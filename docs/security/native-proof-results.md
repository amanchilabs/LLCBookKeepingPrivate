# Native Security and Backup Proof Results

Status: incomplete. iOS Simulator and Android API 36 emulator proofs passed for SQLCipher storage and in-memory native backup authentication/restore. An iOS-created backup was imported on Android, including after a fresh Android reinstall, and its record and attachment were checked after restore. Android-to-iOS file restore, physical-device behavior, and production release controls remain unverified. Do not start the full MVP or claim production readiness from these results.

Test date: 2026-10-30.

## Environment

- iOS: Xcode 26.6, iOS 26.5 runtime, iPhone 17 Simulator, Expo development build. No physical iPhone was available.
- Android: API 36 Pixel 8 AVD, Android Emulator 37.2.13, Expo native development build (not Expo Go). The first Gradle build failed with `No space left on device`; a retry completed successfully, installed, and launched the app. No physical Android device was available.
- The first failed Android attempt had 124 MiB free at the failure point. A cleanup command for task-installed Android SDK and AVD files was rejected by the environment's file-deletion guard; the SDK/AVD remain local and outside Git. The repository's generated `android/` project is ignored.
- The configured public remote is `https://github.com/veerrajuamanchi/LLCBookKeepingPrivate.git`. All fixture data is synthetic.

## Result matrix

| Capability | iOS native development build | Android native development build | Evidence / limitation |
| --- | --- | --- | --- |
| SQLCipher version reported before schema access | PASS: 4.17.0 community | PASS: 4.17.0 community | App proof screen queried `PRAGMA cipher_version`. |
| Generated database key stored and retrieved through SecureStore | PASS | PASS | 32 random bytes; key persisted and re-read through SecureStore. |
| Database and synthetic attachment survive close/reopen | PASS | PASS | Synthetic note and BLOB read back from SQLCipher database. |
| Data survives application process restart | PASS | PASS | App process was stopped, relaunched, and the same database record was read again. |
| Incorrect key cannot read the database | PASS | PASS | A separate connection with a random incorrect 32-byte key failed schema access. |
| Ordinary host SQLite cannot read encrypted database | PASS | PASS | Host `sqlite3` against copied simulator and emulator databases returned `file is not a database (26)`. |
| Build without SQLCipher fails closed before data access | Pending | Pending | Config supports a negative build switch; no native negative build was completed. |
| Native backup encryption and in-memory decrypt | PASS | PASS | Uses Expo Crypto AES-256-GCM and Quick Crypto PBKDF2-HMAC-SHA-256, 600,000 iterations. |
| Wrong passphrase, ciphertext tampering, truncation rejected | PASS | PASS | Native proof checked each rejection. |
| New local key generated for restore | PASS | PASS | In-memory restore generated a SecureStore key different from the source database key. |
| Synthetic database row and attachment restored and reopened | PASS | PASS | Restored into a separate SQLCipher database and read back. |
| Failed restore preserves an existing target and source data | PASS | PASS | A synthetic sentinel remained readable after wrong-password, tampering, and truncation attempts; source row was re-read. |
| Fresh-install restore from an exported backup file | Pending | PASS | Android app was uninstalled/reinstalled, then imported an iOS-created encrypted file into a new-key proof database and read back its synthetic record and attachment. This does not yet implement swapping the proof DB into an active books database. |
| iOS-created backup restored on Android | Pending | PASS | iOS Simulator exported a 201-byte encrypted backup; the file was transferred through a local test path and selected from Android Downloads. The Android restore reopened its new-key SQLCipher database and compared the record and attachment bytes. |
| Android-created backup restored on iOS | Pending | Pending | Android export was downloaded to the iOS Simulator, but the Files document picker showed an unavailable Recents provider and no restore completed. |
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
- Android API 36 native development build: Gradle build completed successfully after the initial disk-space failure; app installed and launched on the Pixel 8 AVD.
- Android native storage proof: SQLCipher 4.17.0 community, SecureStore key persistence, database reopen, synthetic record/BLOB persistence, and wrong-key rejection all passed.
- Android process restart: force-stopped and relaunched the app, then repeated the SQLCipher/storage proof successfully against its existing database.
- Host SQLite inspection of a database copied from the Android emulator: expected failure, exit code 26, `file is not a database`.
- Android native in-memory backup proof: all seven result flags passed: wrong passphrase, tampering, truncation, fresh local key, restored DB reopened, attachment restored, failure preservation.
- Android file workflow: exported an encrypted synthetic backup through the OS share sheet, selected it from Downloads in the document picker, and completed the restore/read-back check.
- Cross-platform and fresh-install restore: exported a backup on the iOS Simulator, copied the encrypted file through a local-only test path to Android Downloads, uninstalled/reinstalled the Android development build, then restored with the backup passphrase. The app generated a new local key and verified the record and attachment bytes after reopening the restored SQLCipher database.
- Android-to-iOS restore attempt: downloaded the Android-created encrypted backup to the iOS Simulator and opened the document picker; its Files Recents provider displayed “Content Unavailable” and the import did not complete. Reverse-direction compatibility remains pending.
- Browser preview Playwright check at 1440×1050 and 390×844: exact required notice visible; member navigation and sample-only transaction notice worked; no file or free-text intake controls; no horizontal viewport overflow; no page errors.

## Recommendation and remaining gates

Continue and revise this validation slice before implementation of the bookkeeping MVP. Android native build and runtime proofs pass on an API 36 emulator, and one iOS-to-Android fresh-install file restore passes. Next complete the Android-to-iOS restore, SQLCipher-disabled fail-closed build, fresh-install restore on iOS, temporary-file scan, and a measured KDF benchmark. Physical-device behavior, OS backup exclusions/transfers, file protection, local-network-disabled operation, store privacy disclosures, and encryption export review remain release gates. Do not claim full cross-platform compatibility or production readiness until those checks are completed and reviewed.
