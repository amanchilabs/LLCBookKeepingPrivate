# RECOVERY-002 — FAILED_REVIEW

Capability: CAP-BOOK-RECOVERY-001

Branch: feature/bookkeeping-full-recovery-20261116

Exact source revision: 6e1ac363a87010ed7fdeae7ca98480f4dfbf3072

Outcome: Read docs/recovery/AUTHORIZATION-20261116.md and IMPLEMENTATION-PLAN-20261116.md. Owner-authorized non-UI only; no UI/assets/registry/approval edits, dependencies, accounting semantics changes, new agents, native commands, branch changes, commits or pushes. Write meaningful failing tests first; coordinator executes checks. Reuse existing patterns, keep files focused. Document exact limits. Passphrase-encrypted complete dataset backup APIs. Use RECOVERY-001 APIs to encode/decode a complete bookkeeping payload under the EXISTING authenticated portable AES-GCM/PBKDF2 envelope (600000 iterations and existing bounds), with a separate explicit bookkeeping payload discriminator/version so proof-only payloads cannot be restored as books or vice versa. Add pure non-UI create/decrypt backup APIs using an injected crypto interface and native adapter reusing existing crypto.native.ts production encrypt/decrypt implementation; browser unavailable behavior remains unchanged. Validate payload before encryption and strict decode/schema/manifest after authentication; enforce bounds before expensive work, zero transient plaintext buffers when owned, no keys/passphrases in logs/errors/payload. Restore works with passphrase and backup bytes, not original Keychain. Tests must perform real AES-GCM/PBKDF2 roundtrips using Node crypto adapter with identical production envelope/authenticated metadata; mock-only roundtrips are insufficient. Cover different ciphertext for same data, exact restored payload, wrong password, bit flips in header/salt/nonce/ciphertext/tag, truncation, unsupported envelope/payload/schema, oversized input, weak passwords and proof-payload rejection. Clearly label host crypto conformance tests versus unexecuted native implementation. Do not wire UI or replace proof backup.

Validation tier: product-defined; see approved command list.

Checks and independent review: [RECOVERY-002.json](RECOVERY-002.json).

Limitations: validation blocked; no progression.

Next action: reconcile failure before resume.
