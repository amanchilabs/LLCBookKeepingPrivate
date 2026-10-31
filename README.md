# LLCBookKeepingPrivate

LLCBookKeepingPrivate is being developed as a local-first bookkeeping application for U.S. LLCs. The native source now includes a first business workflow for LLC setup, confirmed member ownership interests, bank/cash accounts, opening balances, and cash income/expense entries backed by the existing encrypted database. Milestone 1 acceptance and production readiness are not complete.

## Native bookkeeping workflow

On iOS and Android development builds, the primary screen is the bookkeeping workspace with Dashboard, Transactions, Accounts, Members, Reports, and Settings. New installations begin with LLC setup. The 40% / 20% / 20% / 20% member split is suggested and must be explicitly confirmed. The current app calculates account balances and cash-basis income/expenses from persisted journal lines. Transaction correction keeps the original entry and posts a reversal plus replacement; CSV export is user initiated.

Current scope is USD, cash-basis receipts and payments, and one LLC profile per installation. Receivables, payables, transfers, tax calculations, member loans, and guaranteed payments are not implemented. See [Milestone 1 accounting policies](docs/bookkeeping/m1-accounting-policies.md). The synthetic setup-to-correction workflow has been demonstrated in an iOS simulator, including close/reopen persistence and reconciled CSV generation. Android UI acceptance and production release gates remain unverified; passing host tests and typecheck do not complete Milestone 1.

Do not use real financial records until the documented security and recovery gates pass and the user approves.

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

## Native proof builds and recovery tools

SQLCipher and platform key-storage checks require Expo development builds, not Expo Go. Native SQLCipher, SecureStore, restore, and portable-backup proofs remain available from Settings. The web target remains a synthetic preview with no bookkeeping persistence. See the [architecture decision record](docs/architecture/ADR-0001-native-local-storage-and-portable-backup.md), [dependency inventory](docs/security/dependency-inventory.md), and [native proof results](docs/security/native-proof-results.md) for current capabilities and gaps.

## Checks

```sh
npm run test
npm run typecheck
npm run doctor
```

Passing host checks cover domain behavior and the SQL repository against an in-memory/file-backed SQLite test adapter; they do not establish native UI behavior, installed-app persistence, legal or tax correctness, cross-platform backup compatibility, or production readiness.
