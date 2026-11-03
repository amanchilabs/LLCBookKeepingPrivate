# STORY-SEARCH-2 — VALIDATED

Capability: CAP-SEARCH-USABILITY

Branch: feature/foundry-llc-pilot-20261103

Exact source revision: 61ae2154abae7341f50b1219d1f7a2816cff7df0

Outcome: Presentation-only, synthetic data. Existing search results/navigation must remain identical. Read CLAUDE.md and mapped design specifications; owner baseline main 0710e5188ba52199eb230be01c0289ec07bba902 supersedes historical migration branch hints. No edits to domain, storage, schema, auth, security, dependencies or accounting. Add meaningful component-level tests with vitest and existing react-dom/server; mock RN only at the host boundary. Test real rendered components/handlers, not source strings. Native platform acceptance remains a separate required coordinator check; never claim VoiceOver/TalkBack acceptance from props. Do not update progress docs: coordinator owns those. Extract the existing SearchResultRow and kind-label mapping into search-result-row.tsx. Preserve every kind label, key and onNavigate result identity. Improve result button accessibility by announcing kind/title/details and using a separate accessibilityHint for opening its destination; set minimum row touch height to 48 using the established tokens/helper where appropriate, retaining existing layout. Add search-result-row.test.tsx with all kind mappings, exact destination hints, details, long text, minimum touch height, and handler forwarding the exact original result. Tier 2 bounded presentation change. Expected model: Claude CLI login default. Deliver source and focused tests. Coordinator native evidence will be saved under /tmp/llc-foundry-pilot-native/<exact-source-SHA>/ on dedicated synthetic iOS and Android targets. Review those screenshots using Read as well as tests; do not claim assistive-technology hardware acceptance.

Validation tier: product-defined; see approved command list.

Checks and independent review: [STORY-SEARCH-2.json](STORY-SEARCH-2.json).

Limitations: local checks only; no merge, deployment or product acceptance implied.

Next action: next approved Story, or stop at the capability boundary.
