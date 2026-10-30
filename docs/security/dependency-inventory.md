# Dependency and Network Inventory — Native Security Proof

Snapshot date: 2026-10-30. The versions below are exact direct dependency pins selected from the current Expo SDK 58 release line and package registry. They must be recorded in package.json and package-lock.json; a lockfile audit after installation is authoritative. This inventory covers the proof slice, not future V1 dependencies.

Tooling: Node.js 24.22.2, pinned in `.node-version`; SDK 58 / React Native 0.88 and Vitest 5 do not support the environment's system Node 25. Node is a development prerequisite and is not bundled into the app.

## Direct dependencies

| Package | Exact version | Purpose | Native/web scope | Runtime network |
| --- | --- | --- | --- | --- |
| expo | 58.0.21 | Expo SDK and local development/build integration | iOS, Android, Web | No financial service. Development tooling connects to local Metro only. |
| react | 19.3.0 | UI runtime aligned with the Expo SDK 58 TypeScript template | iOS, Android, Web | None by application use. |
| react-native | 0.88.1 | Shared native UI primitives | iOS, Android; web through RN Web | None by application use. |
| expo-sqlite | 58.0.14 | SQLite persistence; SQLCipher plugin for native builds | iOS, Android; web implementation exists but is not used for preview data | Local database only. |
| expo-secure-store | 58.0.2 | Small native local database key storage | iOS, Android only | Keychain / Android Keystore-backed encrypted preferences; no server. |
| expo-crypto | 58.0.7 | Async CSPRNG and AES-GCM encrypt/decrypt APIs | iOS, Android, Web | Platform crypto only. No network API use; web preview must not handle backup or real data. |
| expo-file-system | 58.0.13 | App-private database directory and encrypted backup cache files | iOS, Android | Package supports network upload/download APIs; this app calls only local file methods. No remote destination is configured. |
| expo-document-picker | 58.0.4 | User-initiated selection of an encrypted backup file | iOS, Android | Reads a user-selected local/provider URI; the app does not upload it. Provider apps may have their own behavior. |
| expo-sharing | 58.0.21 | User-initiated encrypted backup handoff to OS share sheet | iOS, Android | Sends a selected encrypted artifact to an app/destination only after explicit user action. Recipient behavior is outside app control. |
| expo-dev-client | 58.0.17 | Native development builds containing SQLCipher-linked modules | Development builds only | Development build may load JS from local Metro; exclude from release dependency install where possible. |
| react-native-quick-crypto | 1.1.9 | Native callback-based PBKDF2-HMAC-SHA-256 using bundled OpenSSL | iOS and Android native development builds; not used by Web | Local cryptographic work only. Requires New Architecture and Nitro Modules. |
| decimal.js | 10.6.0 | Arbitrary-precision decimal domain calculations | Pure JavaScript | None. |
| react-dom | 19.3.0 | React DOM runtime for browser preview | Web only | None. |
| react-native-web | 0.21.4 | Render shared React Native components in the browser preview | Web only | None. |
| @expo/metro-runtime | 58.0.15 | Expo Metro runtime for local web/native development | Web and development builds | Local Metro only in development. |

## Development dependencies

| Package | Exact version | Purpose | Runtime inclusion |
| --- | --- | --- | --- |
| typescript | 6.0.3 | Static type checking; version required by the Expo SDK 58 compatibility check | No. |
| @types/react | 19.3.0 | React declarations matching the pinned React runtime | No. |
| vitest | 5.0.5 | Independent pure-domain and backup-container tests | No. |

Expo SDK packages are pinned to the SDK 58 line; React and React Native match its blank TypeScript template. `expo-crypto` supplies native AES-256-GCM; `react-native-quick-crypto` 1.1.9 supplies native PBKDF2 and requires the New Architecture plus Nitro Modules (`react-native-nitro-modules` 0.37.1 and `react-native-quick-base64` 3.0.1 resolved in the lockfile). `decimal.js` is pure and independently testable; Expo SQLite supplies SQLCipher only when the native config plugin is enabled. Dependency choice is not proof of build/runtime behavior. No UI component library, ORM, router, crash service, analytics package, or backend SDK is needed for this small slice. `npm run doctor` runs Expo's SDK package compatibility check (`expo install --check`); it is not the separate `expo-doctor` package.

## Excluded network and update services

- Do not install expo-updates, EAS Update integration, remote configuration, analytics, advertising, crash reporting, Sentry, payment, bank, AI, sync, login, or cloud packages.
- Expo app config must disable updates. Production runtime should have no HTTP, WebSocket, upload, or telemetry path. Search source and inspect the native dependency/manifest output before release.
- Development scripts set EXPO_NO_TELEMETRY=1. A development client can fetch the JavaScript bundle from the local Metro host; it must not use a public tunnel or a hosted bundle for this proof.
- NPM registry access, CocoaPods, Gradle/Maven, and Xcode/Android SDK downloads happen only when a developer installs/builds. They are build-time network access, not app data transmission.
- The proof release configuration has no app backend and no automatic updates. Localhost web hosting serves static UI code only and is not a data backend.

## Inventory checks

After scaffold and lockfile creation, record the results of:

1. npm ls --all --json, reviewed for unexpected direct/transitive network SDKs and duplicate crypto packages.
2. Search package manifests, source, app config, generated native projects, and lockfile for expo-updates, analytics, crash reporting, upload APIs, fetch, WebSocket, and remote URLs.
3. Inspect iOS entitlements/plist and Android manifest for network permissions and backup behavior. Android networking permission required by development tooling must not be mistaken for an app data endpoint; release inspection must state whether INTERNET remains in the final binary.
4. Run the built native proof with the host disconnected from all external networks after the app is installed. Do not use the Expo Web preview as evidence for native offline operation.

The `package-lock.json` records resolved transitive versions. `expo-file-system`, `expo-document-picker`, and `expo-sharing` can touch files selected by a user or support network transfer features; this application uses them only for local encrypted artifacts and explicit OS sharing. The local Expo development server itself requires a loopback connection to serve the preview or bundle. The lockfile still requires a full transitive review before release.

## Restore/security continuation results (2026-10-30)

- Build policy defaults to SQLCipher enabled. `LLCB_SECURITY_NEGATIVE_SQLITE=1` disables it only for a test configuration; `EAS_BUILD_PROFILE=production` plus the flag throws during config evaluation. Automated tests verify this and the storage opener probes a memory-only connection before any persistent database path. A native negative-build artifact/runtime scan remains pending.
- Expo config sets updates disabled. Local config plugins add iOS app-private directory backup exclusion and Android `allowBackup=false`, full backup exclusions, and Android 12+ cloud/device-transfer exclusions. At the current tested source SHA, iOS Simulator Debug and Android Debug builds passed with SQLCipher enabled. Simulator app-level backup behavior and Android OEM transfer results are still pending.
- Current source has no application `fetch`, WebSocket, upload, analytics, crash, ad, remote config, bank, payment, account, or AI use. Search did not identify a runtime OTA package. Development Android manifest contains INTERNET; no current-branch release-like manifest or external-network-isolated test is available.
- Restore import uses a selected file URI with `copyToCacheDirectory:false`, validates size before reading, keeps decrypted content in memory, and zeroes byte buffers best-effort. Export caches only the encrypted container and deletes it after the OS share callback. These are code-path observations, not a forensic proof of no plaintext residue. Provider/recipient copies, JS strings, native buffers, and device compromise are outside the cleanup claim.
- Historical KDF evidence in the previous report: iPhone 17 Simulator, PBKDF2-HMAC-SHA-256 600,000 iterations, five samples, median 45.3 ms and p95 53.1 ms. Its exact source SHA was not recorded, so it is not current-commit evidence. No physical-device or Android benchmark, peak-memory measurement, or offline guessing assessment. OWASP's current password-storage guidance names 600,000 HMAC-SHA-256 iterations for the FIPS-related PBKDF2 case; it is not an evaluation of this app's offline-backup threat model. **Parameter policy for release:** do not reduce below 600,000 iterations without a new security review; benchmark low-end supported physical devices and select the highest work factor whose p95 remains at or below 1 second on every supported target. If this floor/latency gate cannot be met, do not release this KDF design; review a different vetted format/derivation approach rather than silently lowering the cost. Benchmark results and policy are not a recommendation to reuse weak passphrases. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- npm advisory commands were reproducibly captured at `2026-10-30T18:19:36Z` UTC using Node 24.22.2/npm 11.6.2. The full and production-omitted machine-readable outputs and advisory-by-advisory paths are under `audits/`. Both findings remain open; no risk was accepted and no forced Expo downgrade or unsupported override was used.
- An earlier report described ten iOS Simulator exception boundaries but did not record the tested source SHA; that result is historical, not current-commit evidence. No hard process-termination run was completed.

### Checks performed for this proof slice (2026-10-30)

- `npm ls --all --json` completed and the dependency tree was searched for update, analytics, crash reporting, telemetry, HTTP-client, payment, bank, and cloud SDK names. No app analytics, crash-reporting SDK, backend, sync, bank, payment, or AI SDK was found.
- The tree contains `expo-updates-interface` through `expo-dev-client`; the `expo-updates` package and OTA service are absent. `@opentelemetry/api` is under Vitest only. `update-browserslist-db` is a development tooling dependency.
- Source/config search found no app `fetch`, WebSocket, or upload API use. The generated Android development manifest includes `android.permission.INTERNET` for development tooling. Release manifest output must be reviewed; the permission is not evidence by itself that the app sends records.
- Public Expo config shows updates disabled and Android `allowBackup: false`. Android generated config also references the SecureStore backup rules and data-extraction rules. The iOS exclusion plugin compiles in the current iOS debug build; runtime backup exclusion remains unverified.
- Native use of DocumentPicker and Sharing is explicit user action. Recipients and provider apps may have their own network behavior; no background transfer is configured by the application.
- `npm audit --omit=dev` exited 1 in the committed audit snapshot with 8 reported entries (5 low, 3 high) propagating two unique advisories: `deepmerge` prototype poisoning and Zod array-validation memory exhaustion. Paths and original sources are in the advisory assessment. The audit was not rerun in this continuation. No downgrade or override was applied; no residual risk was accepted.
- Disconnected-network operation, final release-manifest inspection, privacy labels, and export-control review remain release checks; no result is claimed for them here.
