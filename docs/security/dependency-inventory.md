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

### Checks performed for this proof slice (2026-10-30)

- `npm ls --all --json` completed and the dependency tree was searched for update, analytics, crash reporting, telemetry, HTTP-client, payment, bank, and cloud SDK names. No app analytics, crash-reporting SDK, backend, sync, bank, payment, or AI SDK was found.
- The tree contains `expo-updates-interface` through `expo-dev-client`; the `expo-updates` package and OTA service are absent. `@opentelemetry/api` is under Vitest only. `update-browserslist-db` is a development tooling dependency.
- Source/config search found no app `fetch`, WebSocket, or upload API use. The generated Android development manifest includes `android.permission.INTERNET` for development tooling. Release manifest output must be reviewed; the permission is not evidence by itself that the app sends records.
- Public Expo config shows updates disabled and Android `allowBackup: false`. Android generated config also references the SecureStore backup rules and data-extraction rules. iOS backup exclusion has not been set or verified.
- Native use of DocumentPicker and Sharing is explicit user action. Recipients and provider apps may have their own network behavior; no background transfer is configured by the application.
- `npm audit --omit=dev` exited 1 with 8 reported vulnerabilities (5 low, 3 high). The reported affected transitive packages include `deepmerge` (prototype poisoning) and `zod` below 4.6.6 (memory exhaustion); the audit paths include Expo config/CLI dependencies. `npm audit` offered only a forced Expo 51 downgrade for the reported fixes, so no downgrade or override was applied. Review patched, SDK-compatible dependency updates and runtime reachability before release.
- Disconnected-network operation, final release-manifest inspection, privacy labels, and export-control review remain release checks; no result is claimed for them here.
