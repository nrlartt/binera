# Implicit state machines in Binera

Analysis date: 8 November 2026. Scope: every `useState`, union type, `status`/`phase`/`stage` field, derived transition helper, persisted record schema and on-chain enum in the repository. No behaviour was changed.

**Summary:** 33 state machines were identified. 9 are persisted (localStorage, server JSON or chain), 24 are in-memory/derived. Six machines carry money or permission risk; the rest are view, cache or process state.

Legend: **S** = states, **T** = transitions, **G** = guards/invariants, **P** = persistence.

---

## A. Money, permission and hiring

### A1. Quote lifecycle — `components/activation.tsx`, `lib/quote.ts`, `api/quote`
- **S:** `none → requesting → verified → approved → consuming → consumed | expired | failed`
- **T:** task edit → `none` (also clears approval); `Get quote` → requesting; server verify (canonical hash, chain 56, contract, currency, expiry, same task) → verified; checkbox → approved; `activate` → consuming; success → record; 3 re-checks of expiry during activation.
- **G:** quote task must equal current task text; price > 0; verifying contract/payment token fixed; `quote.expiresAt*1000 > now+30s` before funding, `> now+15s` after permission.
- **P:** in-memory only (the quote JSON is copied into the activity record).
- **Observations:** `approved` is a boolean, not a state, so the UI can show "verified" and "approved" independently; `now` starts at 0, so the expiry check is momentarily false-safe until the first tick. A quote is never marked "consumed" after a successful hire; the record is the only trace.

### A2. Activation orchestration — `components/activation.tsx`
- **S:** `idle → service-check → balance → permission-request → granting → funding → confirming (20 × 1.5 s) → notifying → tracked`
- **T:** every step sets a human-readable `busy` string; failures are written to the activity record with `failureStage ∈ {balance, permission, funding, delivery}` and `failureReason ∈ {insufficient-funds, permission-rejected, user-rejected, unconfirmed}`.
- **G:** single `lock` ref prevents concurrent runs; unresolved earlier session blocks a new grant; category must belong to the agent; service must be available; storage writable; quote not expired.
- **P:** partial state persisted before network calls so a relay timeout is not lost ("revocation reference saved before submission").
- **Observations:** `busy` string doubles as the phase identifier (sentinel-string state machine); there is no explicit "abandoned" terminal — the record stays `pending` after an unconfirmed step. Re-opening the page resumes from persisted activity, not from this machine.

### A3. Activity record — `lib/activity.ts`, `components/dashboard.tsx`
- **S:** `pending → permission-granted → funded → revoked` (declared) + orthogonal failure overlay (`failureStage`, `failureReason`).
- **T:** `pending` at first save; `permission-granted` after `grantSession`; `funded` after chain confirmation; `revoked` after revocation. Failure does **not** change `status`, only the overlay.
- **G:** schema binds `id` to session public key and wallet; max 1,000 records; imports strip unknown fields; wallet match required.
- **P:** localStorage (`agentmarket-activity-v1`).
- **Observations:** `status` never becomes `failed`/`expired`; "unresolved" is derived as `!jobId && status !== "revoked" && expiry > now`. Chain truth is not written back into the record, so dashboard status and job status can disagree by design.

### A4. Funding transfer — `lib/transfers.ts`, `components/browser-wallet.tsx`
- **S:** `unknown → submitted → confirmed | reverted`; `unknown → cancelled` (manual attestation only).
- **T:** send → `unknown`; wallet returns hash → `submitted`; receipt check → `confirmed`/`reverted`; user confirms non-broadcast → `cancelled`.
- **G:** any `unknown|submitted` blocks a new transfer ("unresolved"); reverted transfers do not auto-retry; pasted hash must match `0x…64`.
- **P:** localStorage (`binera-transfers`).
- **Observations:** `pending` is not a stored state (only the API projection); a wallet rejection leaves `unknown` (not `cancelled`) unless the user asserts it. No automatic receipt poll.

### A5. On-chain job — external ERC-8183 + `lib/job-match.ts`, `lib/job-windows.ts`, `api/jobs/[id]`
- **S:** `OPEN → FUNDED → SUBMITTED → COMPLETED | EXPIRED` (SDK naming).
- **Derived actions:** `approve` (SUBMITTED and now ≥ submittedAt+disputeWindow), `dispute` (SUBMITTED and now < deadline), `refund` (OPEN/FUNDED/EXPIRED and now > expiredAt).
- **Derived windows:** `delivery` open/closed/done/not-applicable; `dispute` open/closed/not-applicable.
- **G:** server reads policy `disputeWindow` and current block; deliverable is hash-verified before display.
- **P:** chain.
- **Observations:** this is modelled **three times**: server actions (`jobActions`), UI windows (`jobWindows`), and dashboard copy (`nextStep`). Statuses outside the handled set (e.g. refunded/cancelled) fall through to raw display. **Clock mismatch:** `JobWindows` passes the device clock (`Date.now()`) as `chainTime`; the label warns about it, but the contract clock is authoritative. `job-windows` itself is pure and accepts a chain timestamp.

### A6. Delivery acknowledgement — `lib/delivery.ts`
- **S:** seller response → `acknowledged | not-acknowledged`.
- **T:** success only for `accepted:true` or `status ∈ {accepted, processing, queued, submitted, completed, already_processing, already_submitted}`; `rejected|failed|error`, `accepted:false`, job-id mismatch or schema failure → not acknowledged.
- **G:** funding remains on-chain regardless of acknowledgement.
- **Observations:** implicit enum over untrusted strings; unknown statuses default to not-acknowledged.

### A7. Relay submission — `api/submissions/[id]`
- **S:** `pending → confirmed | failed`.
- **T:** string `CONFIRMED` or numeric 2xx → confirmed; `FAILED` or 3xx–6xx → failed; everything else → pending.
- **Observations:** numeric ranges are an implicit protocol contract with the relay; no persisted state.

### A8. Service readiness — `server/studio.ts`, `api/agents/[id]/availability`
- **S:** `compatible | unsupported | unconfirmed`.
- **T:** card fetch + skills + registered wallet → compatible; PublicError 409 → unsupported; everything else → unconfirmed. Cached 30 s.
- **Observations:** three-state machine conflates "unsupported" (deterministic) with "unconfirmed" (transient).

### A9. Server quote negotiation — `server/studio.ts`, `lib/quote.ts`
- **S:** `idle → card → identity-wallet → negotiate → decode → signature-verify → verified | error`.
- **G:** same-origin card; required skills; canonical JSON hash; EIP-191 against on-chain wallet; timestamps; expiry; same task; fixed contracts.
- **P:** stateless (cache only).
- **Observations:** excellent explicit guard chain; the only implicit part is that the seller's state is not re-checked after signature verification.

---

## B. Marketplace exchange (off-chain, wallet-signed)

### B1. Open request — `lib/server/marketplace-store.ts`, `components/exchange.tsx`
- **S:** `open → accepted` (when filled slots reach `slots`); `closed` exists in the schema but is **never assigned**.
- **T:** create → open; accept offer → accepted if slots filled, otherwise stays open; offers rejected when full.
- **G:** future deadline ≤ 90 days, max 20 open per wallet; owner cannot offer; only owner accepts; max 25 offers.
- **P:** `.data/marketplace.json` (single instance).
- **Observations:** deadline is validated on create but **not enforced afterwards** — expired open requests remain visible and offerable. No cancel/close/expire transition. Accepting an offer does not create or link an escrow job; the machine stops at `accepted`, so the 1:1 path to funding is manual.

### B2. Offer — same files
- **S:** `pending → accepted | rejected`.
- **T:** create → pending; owner accepts → accepted; request filled → pending offers rejected; no withdraw/expire.
- **G:** request open; owner ≠ request owner; one pending per wallet/request; cap 25.
- **Observations:** rejected-by-fill and rejected-by-other-accepted are the same state; no reason recorded. Expiry is not modelled.

### B3. Service listing — same files
- **S:** `active` only. `active:false` is never written; no update/deactivate/delete path.
- **G:** max 20 active per wallet; HTTPS endpoint; price > 0.
- **Observations:** effectively a one-way create machine; the `active` flag is dead state. Editing requires publishing a new listing.

### B4. Exchange view — `components/exchange.tsx`
- **S:** `tab ∈ {requests, listings, publish}` × `publishKind ∈ {request, listing}` × offer modal `offerFor: Request | null` × `busy` sentinel (`offer`, `publish`, `accept-<id>`).
- **T:** tab clicks; empty-state buttons also set `publishKind` then tab; successful offer closes modal; refresh reloads snapshot.
- **Observations:** `busy` string is the only thing preventing double submission; success/error notices are independent and cleared at action start. No "armed" confirmation for publishing.

### B5. Device-data clearing — `components/device-data.tsx`
- **S:** `idle → armed(scope|all) → cleared | cancelled`; `message` is a parallel status line.
- **T:** first click arms; second click same scope clears; cancel disarms; another scope replaces the armed scope.
- **G:** passkey references are never in any clearing scope.
- **Observations:** no timeout on "armed"; navigating away loses it (in-memory).

---

## C. Discovery and view state

### C1. Marketplace search — `components/marketplace.tsx`
- **S:** draft `query` vs committed `submitted`; `filters` open; `catalog ∈ {research, registry}`; `sort`; `verified`; `page`; `ready` gate; `loading`; `data | error`.
- **T:** submit/search → `submitted=query, page=1, refresh++`; any filter change → page reset + refresh; browser back/forward → `popstate` restore; each load rewrites the URL with `history.replaceState`.
- **Observations:** four independent boolean/string state axes produce many combinations; URL is the de facto serialization but `ready` guards the first load. `loading` is set manually before each trigger and cleared in `finally`; an aborted request relies on the signal check.

### C2. Comparison — `components/comparison.tsx`, `components/shell.tsx`
- **S:** selection `0..3` agents; per-agent quote map `quote | error`; `quoting`; `now` ticker; version ref.
- **T:** toggle add/remove; fourth add blocked; different-category add blocked; selection persisted; quotes cleared when ids change; draft (research task) transferred to activation.
- **G:** shared category; 3 max; same task text used for all quotes.
- **P:** localStorage compare selection; quotes in memory.
- **Observations:** quote expiry is displayed but comparison does not invalidate quotes by time alone.

### C3. Agent detail — `components/agent-detail.tsx`
- **S:** `loading → agent | error`; optional `match` from the last search intent.
- **Observations:** intent is read once from sessionStorage; no re-fetch on intent change.

### C4. Research desk — `components/research-toolkit.tsx`
- **C4a overview:** three independent loads (`stats`, `pool`, `refs`) sharing one `overviewError`; each is `null → value` or error. No per-card retry.
- **C4b token scan:** `idle → busy → result | error`; input validated client-side; provider-not-configured is a normal error branch. Result is cleared at the start of each run.
- **C4c pool/health research:** `kind ∈ {pool, health}` × `idle → busy → result | error`; address is prefilled from the market snapshot; result is **not** cleared when `kind` changes, so a pool result can remain visible under the health tab until the next run.
- **Observations:** three separate machines embedded in one component; `kind` is a mode, not a transition guard for the displayed result.

### C5. Research preview — `components/research-task.tsx`
- **S:** keyed cache `{ key, data|error }` + `busy`; key = `category:target`.
- **T:** read → key result; changing category/target hides the old result without deleting it.
- **Observations:** stale data is retained in memory; a return to the previous key shows it again without re-reading the chain.

### C6. Evidence status — `components/evidence-status.tsx`
- **S:** `unchecked → checking → checked` with `deliveries[]`, plus `service` fetch, `quoteUntil` (expired/active), `now` ticker.
- **T:** check → service + up to 10 saved deliveries; completed + hash-verified only counts; failures produce a warning but still set checked.
- **Observations:** `checked` does not distinguish "checked, zero" from "partial check failed"; error and checked can coexist.

### C7. Market context — `components/market-context.tsx`
- **S:** snapshot `idle/busy/error/loaded` + token security sub-machine `idle/busy/result/error`.
- **Observations:** the token security result is not cleared when the token input changes.

### C8. Load-only machines
`registry-coverage`, `leaderboard`, `protocol`, `register-agent`, `device-data summary`, `saved agents` each implement `idle → loading → loaded | error` (sometimes with per-item `null = failed`). `protocol` additionally derives per-contract `not-configured | address-without-code | live`.

### C9. Account modal / passkey — `components/shell.tsx`
- **S:** discovery `savedAccounts[]`; `selectedAccount`; modal `walletOpen`; `wallet | null`; `client | null`; auth mode `create | recover | resume`; `newAccountConfirmed`; auto-restore disabled flag; `busy`; `error`.
- **T:** auto-restore on mount unless disabled; resume requires WebAuthn assertion matching saved address; recover requires two proofs and one unambiguous public key; create requires explicit confirmation and migrates legacy handle; import merges; export downloads.
- **G:** only one account can be active; importing conflicting handles rejected; different domain rejected; user handle must equal saved address.
- **P:** localStorage account references + last account + auto-restore flag.
- **Observations:** `wallet` and `client` are set together but are not a single state; a saved reference can exist without an active session. Closing the modal is blocked while `busy`. Error strings are mapped by regex categories rather than codes.

### C10. Browser wallet — `components/browser-wallet.tsx`
- **S:** providers discovered (EIP-6963 + legacy timer) → `disconnected → connecting → connected(chainId)`; per-connection listeners.
- **T:** `accountsChanged`/`disconnect` → disconnected; `chainChanged` → same connection, new chainId; switch/add network → re-check chain; connect requests accounts.
- **G:** only BSC funding is offered; unknown chains prompt switch; no WalletConnect.
- **Observations:** choices and connection are separate machines; the legacy provider can be added twice (deduped by provider identity). `chainId` is read from events/`eth_chainId`, never assumed.

### C11. Compare dock / toast — `components/shell.tsx`
- **S:** dock visible when `compared.length > 0 && path !== "/compare"`; toast `compareError` (dismissible).
- **Observations:** purely derived; no explicit machine.

### C12. Dialog focus/escape — `components/use-dialog.ts`
- **S:** `open → closed` with focus trap and restore; close blocked by caller-supplied guard.
- **Observations:** open/close is caller state; the hook enforces focus behaviour only.

### C13. Profile and saved agents — `components/profile.tsx`
- **S:** profile `empty/saved/cleared` + message; saved items map `undefined=loading | Agent | null=failed`; compare toggle.
- **Observations:** the `null` entry is an implicit error state for one item; there is no retry per item.

### C14. Exchange live events — `components/exchange.tsx`, `api/exchange/events`
- **S:** client `connecting → open → error/reconnecting` (EventSource auto-reconnect); server `streaming → closed` on abort/cancel.
- **T:** `ready`, `marketplace` (reload snapshot), `heartbeat`.
- **Observations:** the client ignores heartbeats; `onerror` is intentionally a no-op. Server `closed` flag prevents enqueue after abort.

---

## D. Server, cache and on-chain

### D1. Registry aggregation — `lib/server/registry.ts`
- **S:** per provider `fulfilled | rejected(partial)`; aggregate `partial` warnings; cache entry `fresh | expired | failed`.
- **Observations:** partial results are a first-class state (`PartialRegistryError`) and are merged into output with warnings.

### D2. Rate limiting — `src/proxy.ts`, `lib/server/marketplace-auth.ts`
- **S:** fixed window buckets (`reads` 300/min, `limited-external-actions` 40/min) + per-route token buckets (10–20/min).
- **Observations:** two independent machines with different keys; a request can pass one and fail the other. Both are per-process and reset on deploy.

### D3. Health — `api/health`
- **S:** `ok | degraded` with 200/503; chain check (fresh block < 180 s) and discovery check (non-partial, non-empty); integrations `configured | configured-not-probed | not-configured`.
- **Observations:** dependency states are derived from `Promise.allSettled` results.

### D4. Protocol status — `api/protocol`, `components/protocol.tsx`
- **S:** per contract `not-configured → address-without-code → live`; cached 120 s.
- **Observations:** "live" means bytecode exists, not that it is the audited deployment; docs state this.

### D5. Intent pipeline — `lib/server/intent.ts`, `lib/domain.ts`
- **S:** `rules → (optional) language-model → merged`; any model failure returns rules.
- **G:** deterministic constraints cannot be weakened by the model.
- **Observations:** a fallback machine with a strong invariant; no persisted state.

### D6. On-chain arbitration — `contracts/BineraArbitration.sol`
- **S (declared):** `None → Evidence → Voting → Resolved`.
- **S (actual):** `None → Evidence → Resolved`; `Voting` is **never assigned**. Voting is allowed after `evidenceDeadline` by time check; `phase` stays `Evidence`.
- **T:** open → Evidence; votes (after evidence deadline, before vote deadline) → Resolved on two matching votes; `closeExpired` → Resolved (majority, ties to buyer).
- **Observations:** time is the real phase machine; the enum's `Voting` is dead. `finalVerdict` is emitted by `closeExpired` but **not stored** in the case, so readers cannot distinguish a two-vote verdict from a timeout majority.

### D7. On-chain bounty slot — `contracts/BineraBountyVault.sol`
- **S:** slot `0 empty → 1 claimed → 2 approved | 3 rejected`; bounty `open → cancelled` after deadline.
- **T:** claim (before deadline, empty slot); approve (creator, claimed) → pays; reject (creator, claimed) → terminal, no reclaim; cancel after deadline → refunds unapproved.
- **Observations:** rejected is terminal and the slot cannot be re-claimed; there is no per-slot deadline or appeal state.

### D8. On-chain stake — `contracts/BineraStake.sol`
- **S:** no position → staked (locked until `unlockAt`) → unlocked → partially/fully unstaked; slash reduces amount at any time.
- **Observations:** lock is a timestamp, not an enum; slashing bypasses the lock by design.

### D9. On-chain reputation — `contracts/BineraReputation.sol`
- **S:** unseen (score 5000) → recorded (jobs/won/lost++, score ±weight, capped 0–10000).
- **Observations:** counters are the implicit machine; there is no reset or dispute-reversal transition.

---

## Cross-cutting findings

1. **Dead states / flags**
   - Exchange request `closed` is declared but never assigned.
   - Exchange listing `active:false` is never written.
   - Arbitration `Phase.Voting` is never assigned.
   - Activity has no `failed`/`expired` terminal; failure is an overlay.
2. **Missing transitions**
   - Expired open requests stay open and offerable; no cancel/expire sweep.
   - Offers cannot be withdrawn or expired.
   - Accepted exchange offers do not transition into an escrow job (manual step).
   - Listings cannot be deactivated or edited; republishing is the only path.
3. **Duplicated transition logic**
   - Job decisions exist in `jobActions`, `jobWindows` and dashboard copy; adding a status requires three edits.
   - Four status vocabularies (`activity`, `job`, `offer/request`, `transfer`) coexist without a shared mapping.
4. **Clock duality**
   - `JobWindows` receives the device clock as `chainTime`; countdowns can drift from the contract deadline. The pure helper already accepts a real chain timestamp.
5. **Sentinel-string states**
   - `busy` strings in activation, dashboard and exchange act as phase identifiers; they are easy to extend but impossible to exhaustively check at compile time.
6. **Arming without expiry**
   - Device-data clear confirmation stays armed until cancelled or used; no timeout or navigation guard.
7. **Stale result retention**
   - Research desk keeps a pool result visible after switching to health; token-scan and market-context results persist across input changes until the next run.
8. **Persisted vs chain truth**
   - Activity status is local and never reconciled back; dashboard already reads chain separately, so the two machines can disagree without conflict.

## Fixes applied (8 November 2026)

The following defects from this inventory were corrected. The inventory above records the state **before** the fixes.

| Finding | Fix |
| --- | --- |
| Expired requests stayed open and offerable | `snapshot()` now projects past-deadline `open` requests as `closed` and their pending offers as `rejected`; `createOffer`/`acceptOffer` reject past-deadline requests. |
| Request had no closing transition | Added signed `request.close` (owner only). Closing rejects pending offers and emits an event. |
| Listing `active` flag was dead | Added signed `listing.close` (owner only). Deactivated listings disappear from public reads. |
| Offers had no withdrawal | Added signed `offer.withdraw` (offer owner, pending only) with a `withdrawn` status. |
| `JobWindows` used the device clock | `/api/jobs/[id]` now returns `chainTimestamp`; `JobWindows` anchors countdowns to the observed block time plus elapsed device time (`estimatedChainTime`). |
| Job "next step" copy duplicated transition logic | Extracted `nextJobStep()` beside `jobActions()`; the dashboard now uses one source of truth. |
| Activity had no failure terminal | Added `failed` status, written when activation stops before a job ID exists; unresolved protection still applies. |
| Arbitration `Voting` phase was dead and `finalVerdict` was not stored | The first valid vote moves `Evidence → Voting`; both a two-vote verdict and a timeout close persist `finalVerdict`. |
| Rejected bounty slots were a dead end | Added creator-only `reopenSlot` before the deadline; approved slots remain terminal. |
| Stale cross-mode results in Research desk | Switching pool/health clears the previous result; editing a token clears its scan result; overview loads gained a retry action. |
| Armed destructive action had no expiry | Device-data clearing disarms automatically after 10 seconds. |
| Quote expiry could be evaluated before the first clock tick | Activation initialises `now` from `Date.now()` instead of `0`. |

Verification after the fixes: `npm test` → 57/57, `npm run test:contracts` → 11/11, plus typecheck, lint and a production build.

## Suggested next steps (not implemented)

- Extract explicit transition tables/reducers for: hiring (A1+A2), job (A5), exchange request/offer (B1+B2), transfer (A4), account (C9). Keep them pure and unit-test every legal/illegal edge.
- Add a status adapter layer (`jobStatus → uiStatus`) so the four vocabularies share one mapping.
- Persist expiry transitions (a sweep or event) instead of only projecting them at read time.
- Link an accepted exchange offer to an escrow job so the marketplace machine does not stop at `accepted`.
- Replace sentinel `busy` strings with typed phase unions in the three orchestration components.
