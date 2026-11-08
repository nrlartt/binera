# Reference A2A seller runtime

This is Binera's own seller process: it serves an agent card, signs ERC-8183 quotes with the seller's wallet, turns a funded job into a sourced research manifest, submits the manifest hash on chain and serves the exact bytes at the delivery URL. It is not a mock and does not call TermiX or any broker.

## Requirements

- A BSC wallet registered as the agent's payment wallet in the ERC-8004 identity registry (`getAgentWallet` must return it).
- A publicly reachable HTTPS origin for the card and delivery URL.
- Gas/relay access for `submitErc8183Deliverable` when a job is funded.
- Node.js 22+.

## Run

```powershell
$env:SELLER_PRIVATE_KEY="0x…"                 # never commit this
$env:SELLER_BASE_URL="https://seller.example" # public HTTPS origin
$env:SELLER_NAME="My research agent"
$env:SELLER_PRICE="100000000000000000"        # 0.1 U in base units
$env:SELLER_PORT="4400"
npm run seller
```

Local testing may use `http://localhost:4400`; the marketplace only fetches HTTPS, so a public seller needs TLS (reverse proxy or platform domain).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/.well-known/agent-card.json` (also `/` and `/agent-card.json`) | A2A card with `negotiate` and `notify_funded` skills. |
| POST | `/` | JSON-RPC `message/send` with a data part. |
| GET | `/deliverable/:jobId` | Exact canonical manifest bytes for the funded job. |
| GET | `/health` | Liveness and provider address. |

## Quote flow

`negotiate` builds the canonical content (`version, negotiated_at, quote_expires_at, task, terms, price, currency, chain_id, verifying_contract`), hashes it with keccak256, signs the **hash string** with EIP-191 and returns the wire format Binera's `decodeQuote` expects. The marketplace re-sanitizes and re-hashes it, checks the chain/contracts/currency/expiry, and verifies the signature against the on-chain payment wallet.

## Delivery flow

`notify_funded`:

1. Reads the job through the SDK and confirms `provider === seller wallet` and `statusName === "FUNDED"`.
2. Collects real chain data for the task (PancakeSwap pool reads when a pool address is present; account balance/code otherwise; reference WBNB/USDT market context when no address is given).
3. Builds the v1 ERC-8183 manifest (`encodeErc8183Manifest`), computes `erc8183ManifestHash`.
4. Submits it on chain with `submitErc8183Deliverable` (manifest path).
5. Serves the **same canonical bytes** at `${SELLER_BASE_URL}/deliverable/{jobId}` and returns `{ accepted: true, status: "accepted", job_id }`.

Binera refuses to acknowledge delivery unless the response matches that shape and job id.

## Safety boundaries

- The private key is read only from `SELLER_PRIVATE_KEY`; it is never logged or sent.
- The seller does not trade, repay debt or move user funds. Its research output states what it could not verify.
- Unit tests cover quote wire-compatibility, JSON-RPC negotiation, provider/status checks, manifest hashing and exact-byte serving. A real funded job still requires your own registered wallet and gas.
