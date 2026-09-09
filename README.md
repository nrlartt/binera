# Binera Agent Market

Source repository: [nrlartt/binera](https://github.com/nrlartt/binera)

A marketplace for discovering, evaluating, comparing and hiring real BNB Chain agents. The product is the marketplace; agent runtimes sit underneath it.

The selected workspace was empty. This is a single Next.js 16 / React 19 / TypeScript application. There is no synthetic production catalogue, fake APY, generated reputation or transaction simulation.

## Run

Node 22 or newer is required.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Anonymous 8004scan discovery works without an API key. Optional server-only settings are documented in [.env.example](.env.example). Copy that file to `.env.local` to configure them. Never prefix secrets with `NEXT_PUBLIC_`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

`npm start` serves the compiled standalone application, copies its static assets, and binds to localhost by default. Set `HOSTNAME=0.0.0.0` in a deployment environment and `PORT` if needed. Health endpoint: `/api/health`.

## Implemented capabilities (see verification limits below)

- Live, server-side 8004scan discovery combining most-reviewed and recently-updated records with bounded caches, independently refreshable agent details and explicit provider errors.
- Rebalancing, Grid Trading, Yield Optimisation and Health Factor Monitoring have identical discovery, filtering, detail, comparison and activation paths.
- Natural-language keyword interpretation works without credentials. Optional OpenAI Responses structured output extracts constraints only. Invalid, timed-out or unavailable model responses fall back to rules. Explicit low-risk constraints cannot be weakened by the model.
- Deterministic ranking, stable ID tie breaks, asset/protocol eligibility, and evidence-based explanations. Rankings are over a bounded discovery window, not a claim to exhaustively rank the entire registry.
- Unknown investment risk never satisfies a low-risk request. Related agents are labelled as unconfirmed matches. Source descriptions remain publisher claims.
- Compare up to three agents sharing a category; fetch fresh details before rendering comparison. Missing fees, risk, APY and execution history remain unavailable.
- Compatible Studio sellers support live A2A negotiation. The server reads `getAgentWallet` from the identity registry, checks the signed quote's task/hash/expiry/chain/contracts/currency and verifies the provider's EIP-191 signature. The seller's quoted terms are shown before approval.
- Altana passkey account creation/recovery, public credential-handle recovery before the first onchain operation, scoped hiring sessions and ERC-8183 job funding. A public revocation reference is saved before session submission. Signing keys are never stored in localStorage or sent to this server.
- The flagship activation buys a **research deliverable**. It does not claim to automate swaps, grid orders, LP positions or liquidation protection. Exact contracts, method selectors, U cap, BNB fee cap and 15-minute expiry are disclosed. The in-browser hiring key is never sent to the seller and is discarded when the operation/tab ends.
- Real job state, raw-manifest hash verification, delivery retry, settlement/dispute/refund and onchain revocation. Escrow and session revocation are separate operations. No successful state or transaction hash is invented.
- PancakeSwap v3 pool research reads the official factory, pool slot and ERC-20 balances at a single real BSC block. It reports a spot price, fee tier, balances and source time; it does not infer APY or claim these balances are audited TVL.
- TermiX adapter supports the official BSC MCP stdio server, or an operator-provided HTTPS MCP bridge. It exposes only the real `Token_Security_Check` tool for token-level research. No private-key operations are exposed. It is unavailable until a transport is configured.

## Verification

Unit tests use explicitly test-only fixtures. Browser tests use the **live** registry without mocking responses:

```sh
npx playwright test
npm run test:live
```

The browser configuration uses installed Microsoft Edge. Change `launchOptions.channel` if using another installed browser. Screenshots and failure traces are written to ignored `test-results/`.

For optional read-only price negotiation set `LIVE_AGENT_ID` to an actual registry ID before `npm run test:live`. No test creates an account, funds a job or executes a transaction. Live tests may fail if their upstream services are down.

The requested low-risk USDT journey currently returns related agents with missing risk evidence, not falsely confirmed low-risk recommendations. Funding, scoped session registration, execution receipts, delivery and revocation **have not been exercised with a funded user account**. They require a passkey-capable browser, BNB for registration/relay fees, U for the quoted job and explicit user approval. These are release gates, not passing tests.

## Deployment

Deploy to Railway using the included `railway.json` and Dockerfile. Follow [the Railway deployment guide](docs/railway-deploy-tr.md) for login, project linking, runtime variables and HTTPS domain commands. Railway runs `node server.js`, checks `/` for startup and restarts failed processes. Monitor `/api/health` separately for live dependency health.

No public deployment is claimed until a successful deploy and URL verification are recorded. Passkeys are origin-bound; use a stable HTTPS domain before creating a production account.

Or deploy the included container:

```sh
docker build -t binera .
docker run --rm -p 3000:3000 --env-file .env.local binera
```

Keep `.env.local` outside the image. It is excluded from Docker build context. Server secrets are never used at build time. In a container, inject only required keys and deploy it behind HTTPS.

## Operational limits

- No database or server custody. This browser stores public selection/session/job references; chain reads are authoritative. Export public activity references. Clearing local storage removes agent/job labels; use Altana's explorer to inspect all account keys. SDK account recovery requires onchain registration unless a public credential handle is retained on the device.
- Sessions use exact contract/function allowlists; arguments such as the seller are chosen by the application, not constrained individually by the session validator. Token approval is for the exact budget. Revocation does not undo completed work or cancel funded escrow.
- Monitor submitted jobs: optimistic escrow has a dispute window. The UI exposes dispute and settlement actions and the contracts enforce their windows. Failed/rejected/time-out responses never count as confirmation. Pending submissions must be reconciled before resubmission.
- Caches and API rate guards are bounded per process. Configure an ingress/WAF rate limit and provider spending limits for a multi-instance public deployment. Anonymous discovery quotas can be increased with a server-side `SCAN_API_KEY`.
- TermiX is not a general agent discovery API. Its official server is stdio. Configure `TERMIX_COMMAND` and JSON `TERMIX_ARGS` for a separately installed server, or `TERMIX_MCP_URL` for your bridge. Do not put a user wallet or private key in that server. The marketplace has not verified a live TermiX deployment in this environment.
- Browser-created session keys are ephemeral. This application offers paid research hiring, not an always-on portfolio execution worker. There are no fabricated first-party agents to fill that gap.
- Publisher endpoints are untrusted. Server requests resolve and pin a public IPv4 address, disallow credentials/non-HTTPS/redirects, limit bodies and set deadlines. Signed descriptions and deliverables render as text, never HTML.

## Official implementation references

- [8004scan API and OpenAPI](https://8004scan.io/developers)
- [BNB Studio quickstart](https://docs.bnbchain.org/developer-kit/bnbchain-studio/quickstart/) and [architecture](https://docs.bnbchain.org/developer-kit/bnbchain-studio/architecture/)
- [BNB SDK signed negotiation wire format](https://github.com/bnb-chain/bnbagent-sdk/blob/main/typescript/src/erc8183/negotiation.ts)
- [Altana sessions](https://docs.altana.network/concepts/sessions), [passkeys](https://docs.altana.network/sdk/create-passkey-wallet), [ERC-8183](https://docs.altana.network/sdk/erc8183)
- [PancakeSwap contract addresses](https://developer.pancakeswap.finance/contracts/v3/addresses)
- [TermiX BSC MCP](https://github.com/TermiX-official/bsc-mcp)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

See [architecture decision](docs/architecture.md) for repository inspection and boundaries.

## Browser wallet connection

The header offers Connect wallet with EIP-6963 discovery and a legacy injected-provider fallback (MetaMask, Rabby and compatible wallet browsers). Account changes clear the connection. Networks are detected through eth_chainId and chainChanged; switching networks preserves the connection. The UI requests BNB Smart Chain with wallet_switchEthereumChain, adds its fixed configuration only on error 4902, and checks the resulting chain again before funding. Wallet approval remains required. Connection alone requests account access; it is not server authentication or an agent permission grant. No WalletConnect QR service is configured.

Altana SDK 0.9 does not accept injected wallets as its session signer. Users create or unlock their separate passkey marketplace account for activation. A connected browser wallet can send BNB or the SDK-configured U payment token to that account after reviewing the recipient, amount and wallet confirmation. Transfers require BNB Smart Chain; displayed transaction hashes mean submitted, with confirmation available in the explorer. Extension tests use a test-only provider for discovery and account events; real funded wallet transfers remain untested.

See [release and competition readiness assessment](docs/release-readiness-2026-09-09.md) for the September 9 audit, release gates and official submission timing.


## Submission preparation

Read [the owner launch guide in Turkish](docs/owner-launch-guide-tr.md) for domain, credentials, passkey setup, funding, evidence and submission steps. The English [project description](submission/project-description.md) and [experiment plan](submission/agent-advantage-report.md) are drafts; they do not assert unmeasured outcomes.

Run `npm run audit:services` to inspect a bounded, throttled sample of actual registry identities and negotiate read-only quotes by category. Results go to `submission/evidence/service-audit.json`. A rate-limited result is unconfirmed, not proof that a service is dead. Avoid repeated full scans on anonymous API quotas.

Fill `submission/release.json` with real public URLs and completed-job references, then run `npm run check:release`. Its report is an engineering checklist, not a guarantee of eligibility, service quality, security or award selection. Missing evidence fails the check. The GitHub workflow runs type/lint/unit/build/dependency checks; live browser/provider checks remain separate because they depend on external services.

Public-reference imports validate account/session binding and strip unknown fields. Funding history retains submitted and ambiguous transfers across modal closure; confirmed funding requires matching receipt sender, recipient, asset and amount. Pending relay submissions can be queried without another payment. Job actions use the onchain dispute window, and account permission reads support bounded pagination at a fixed block. Health now probes chain freshness and registry availability and returns 503 when degraded. These improvements do not replace actual funded E2E and independent review.
