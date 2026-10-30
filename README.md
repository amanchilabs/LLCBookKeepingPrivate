# LLCBookKeepingPrivate

LLCBookKeepingPrivate is a local-first bookkeeping application for U.S. multi-member LLCs taxed as partnerships. This repository currently contains only an architecture and native-storage proof slice. It is not a complete bookkeeping MVP or production-ready financial software.

## Local browser preview

The Expo Web target is a synthetic-data UI preview only. It has no record persistence, CSV import, receipt intake, or backup controls. Do not enter real financial records or select real receipts in the browser.

The preview displays this notice:

> Synthetic-data preview. Native encryption, secure key storage, and device-security behavior are not validated in this browser.

Run it locally with Node 24.22.2:

```sh
npm ci
npm run start:web -- --port 8081
```

Open <http://localhost:8081>.

## Native proof builds

SQLCipher and platform key-storage checks require Expo development builds, not Expo Go. The native screen contains synthetic-only SQLCipher, SecureStore, and portable-backup proofs. See the [architecture decision record](docs/architecture/ADR-0001-native-local-storage-and-portable-backup.md), [dependency inventory](docs/security/dependency-inventory.md), and [native proof results](docs/security/native-proof-results.md) for current capabilities and gaps.

## Checks

```sh
npm run test
npm run typecheck
npm run doctor
```

Passing checks cover only the implemented proof slice; they do not establish legal or tax correctness, cross-platform backup compatibility, or production readiness.
