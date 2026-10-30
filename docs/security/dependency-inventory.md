# Dependency and Network Inventory — Native Security Proof

Snapshot date: 2026-10-30. The versions below are exact direct dependency pins selected from the current Expo SDK 58 release line and package registry. They must be recorded in package.json and package-lock.json; a lockfile audit after installation is authoritative. This inventory covers the proof slice, not future V1 dependencies.

## Direct dependencies

| Package | Exact version | Purpose | Native/web scope | Runtime network |
| --- | --- | --- | --- | --- |
| expo | 58.0.21 | Expo SDK and local development/build integration | iOS, Android, Web | No financial service. Development tooling connects to local Metro only. |
| react | 19.3.0 | UI runtime aligned with the Expo SDK 58 TypeScript template | iOS, Android, Web | None by application use. |
| react-native | 0.88.1 | Shared native UI primitives | iOS, Android; web through RN Web | None by application use. |
| expo-sqlite | 58.0.14 | SQLite persistence; SQLCipher plugin for native builds | iOS, Android; web implementation exists but is not used for preview data | Local database only. |
| expo-secure-store | 58.0.2 | Small native local database key storage | iOS, Android only | Keychain / Android Keystore-backed encrypted preferences; no server. |
| expo-crypto | 58.0.7 | Async CSPRNG and AES-GCM encrypt/decrypt APIs | iOS, Android, Web | Platform crypto only. Web preview must not handle backup or real data. |
| expo-file-system | 58.0.13 | Read/write encrypted backup artifacts in native app-private storage | iOS, Android | Local file operations only. |
| expo-dev-client | 58.0.17 | Native development builds containing SQLCipher-linked modules | Development builds only | Development build may load JS from local Metro; exclude from release dependency install where possible. |
| @noble/hashes | 2.4.0 | Async PBKDF2-HMAC-SHA-256 for portable backup keys | Pure TypeScript/JavaScript, including React Native | Local CPU only. No random source used; random bytes come from Expo Crypto. |
| decimal.js | 10.6.0 | Arbitrary-precision decimal domain calculations | Pure JavaScript | None. |
| react-dom | 19.3.0 | React DOM runtime for browser preview | Web only | None. |
| react-native-web | 0.21.4 | Render shared React Native components in the browser preview | Web only | None. |
| @expo/metro-runtime | 58.0.15 | Expo Metro runtime for local web/native development | Web and development builds | Local Metro only in development. |

## Development dependencies

| Package | Exact version | Purpose | Runtime inclusion |
| --- | --- | --- | --- |
| typescript | 5.9.3 | Static type checking; selected as a stable Expo-compatible compiler line | No. |
| @types/react | 19.3.0 | React declarations matching the pinned React runtime | No. |
| vitest | 5.0.5 | Independent pure-domain and backup-container tests | No. |

Expo SDK packages are pinned to the SDK 58 line; React and React Native match the current blank TypeScript template. Crypto, persistence, and UI framework dependencies are not selected by popularity alone: their native/web capability and failure behavior are part of the proof acceptance criteria. No UI component library, ORM, router, crash service, analytics package, or backend SDK is needed for this small slice.

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

The `package-lock.json` records resolved transitive versions. This document is an explicit inventory of selected direct packages, not a claim that transitive dependency review is complete before that lockfile exists.
