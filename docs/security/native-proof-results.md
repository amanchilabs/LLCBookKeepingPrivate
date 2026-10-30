# Native Security and Backup Proof Results

Status: pending implementation and native execution. No application code or test result is claimed by this document yet.

## Environment checked on 2026-10-30

- Xcode 26.6 is installed, with an iOS 26.5 Simulator runtime and iPhone simulator device types available. No simulator device was booted during this inspection.
- No physical iOS device was available for testing during this inspection.
- Java 25 and Android command-line tools are present. No Android SDK directory, Android emulator binary, or connected Android device was found during this inspection. Emulator setup is pending.
- The repository is public. Fixtures and all proof records must remain synthetic.

## Result matrix

| Capability | iOS native development build | Android native development build | Evidence |
| --- | --- | --- | --- |
| SQLCipher version reported before database access | Pending | Pending | Pending |
| Generated database key stored and retrieved through SecureStore | Pending | Pending | Pending |
| Database and synthetic attachment survive force-stop/relaunch | Pending | Pending | Pending |
| Wrong key cannot read copied database | Pending | Pending | Pending |
| Ordinary host SQLite cannot read encrypted database | Pending | Pending | Pending |
| Build without SQLCipher fails closed before data access | Pending | Pending | Pending |
| Fresh-install restore uses only file and passphrase and generates a new local key | Pending | Pending | Pending |
| iOS-created backup restored on Android | Pending | Pending | Pending |
| Android-created backup restored on iOS | Pending | Pending | Pending |
| Wrong passphrase, tampering, and truncation rejected | Pending | Pending | Pending |
| Failed restore preserves existing database | Pending | Pending | Pending |
| Backup workflow leaves no plaintext temporary file | Pending | Pending | Pending |
| PBKDF2-600,000 duration and peak-memory notes | Pending | Pending | Pending |

## Execution record

No native build, simulator/emulator test, physical-device test, backup round-trip, database inspection, or package security audit has been run yet. Add dated commands, device/runtime identifiers, observed outputs, and limitations here only after execution. Keep simulator/emulator results distinct from physical-device results.
