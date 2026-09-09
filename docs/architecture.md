# Architecture decision — 8 September 2026

Inspection: category C. The selected directory was empty. No application, lockfile, database, tests, contracts, configuration or reusable components existed. An unrelated Git root exists above this workspace; do not stage or alter it.

One Next.js / TypeScript app, one server integration layer, viem for chain reads and Altana for passkey-controlled accounts, scoped sessions and ERC-8183 hiring. No private signing key is accepted by the app. No database is needed to duplicate blockchain state: discovery uses bounded TTL caches; public session/job references are retained in the user's browser, and status is reconciled against the chain. Session signing material remains in memory only. After reload, recover the passkey to manage or revoke public session handles.

Domain: normalized source-agnostic Agent records, four equal categories, explicit unavailable values, deterministic classification and relevance. Registry results are publisher claims, not audited strategies. Registered identity, published A2A/MCP metadata, recent endpoint health, Binera-compatible hiring and verified completed delivery are separate evidence levels. Unknown risk must never satisfy a low-risk constraint.

UI: discovery, category filters, detail, compatible side-by-side comparison, permission review, activation and dashboard. Progressive disclosure keeps protocol details out of the primary experience. Search never fabricates data. Optional LLM extracts intent only, validated against a strict schema; deterministic filtering and ranking always run locally.

Integrations: 8004scan public API (anonymous works) with server-side source totals and bounded offset pagination, configured BNB Studio A2A cards, Altana SDK on BSC, official PancakeSwap contract reads, optional TermiX MCP read-only tools. The 8004scan key is server-only and changes quota, not evidence status. No arbitrary registry endpoint may be fetched without SSRF checks. Remote requests have deadlines, bounded bodies and no automatic redirects.

Activation: retrieve a live seller card, validate its published contract/payment information and identity before offering escrow. Unknown interfaces display requirements. Do not treat an A2A badge or prose mentioning ERC-8183 as authorization to pay an arbitrary owner. A paid research job is not portfolio automation. Its results require review before any DeFi transaction.

External gates: the workspace has no funded account or passkey. Existing Vercel authentication is invalid. Production build, local deployment and read-only integration tests are possible; real payment/session execution requires a user-owned funded passkey account. Never claim a transaction was completed without a receipt.
