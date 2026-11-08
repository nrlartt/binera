# On-chain protocol contracts

Four Solidity contracts back the remaining marketplace primitives that an off-chain index cannot enforce. They are written and tested against the local Hardhat EVM, deployed on **BSC testnet (chain 97)** and **BNB Smart Chain mainnet (chain 56)**. No UI reads them until operator addresses are configured, so no fake on-chain state is shown.

## Current mainnet deployment (chain 56)

| Contract | Address |
| --- | --- |
| `BineraStake` | `0x6c8e85578cFDF4f5d76bEa50bDe59219a084c9bB` |
| `BineraReputation` | `0x710816e9D8DC8D65D208da5b830CAC85B6c0f927` |
| `BineraArbitration` | `0x6477Aca6E76b186e541C9cE0E3BF09186cCe62Bb` |
| `BineraBountyVault` | `0xe8977Ddbf8b891121A08c0E4ed1029DCAe4956ce` |

Payment token: U `0x55d398326f99059fF775485246999027B3197955`. Deployer `0xB004…91c2`, arbiter `0x5d49…3b8f`. Deployment spent approximately 0.000138 BNB; no user funds were deposited. The arbiter is currently an **EOA**; because it is immutable, moving to a multisig requires deploying a new stake contract. Full hashes: `submission/evidence/mainnet-protocol.json`. Source verification on BscScan still requires an API key.

## Current testnet deployment (chain 97)

| Contract | Address |
| --- | --- |
| `BineraStake` | `0x19077Fec4D3eE64546E1D1e350ceDe51f7De13bb` |
| `BineraReputation` | `0xC4A0e379468F686529898f12E66605BBe01A2dc7` |
| `BineraArbitration` | `0xD88f1087F17De5702E734a62fD5cDC95c54E8116` |
| `BineraBountyVault` | `0x9338B39FD6DA8bF1c230bE26A5A73F33800a2c0d` |

Payment token: test-only `MockERC20` at `0xa10409bFBCf29cE043525399C6BC39Aca457B8dA`. Deployer `0xbAa1…090f`, arbiter `0x5d49…3b8f`. A 1 mU stake and a two-slot bounty were executed to verify reads. Full hashes: `submission/evidence/testnet-protocol.json`. These are testnet-only records.

## Contracts

| Contract | Purpose | Trust boundary |
| --- | --- | --- |
| `BineraStake.sol` | Agent stake with a per-wallet lock (max 365 days). | Slashing is limited to the configured `arbiter`; it can never touch unstaked balances. |
| `BineraReputation.sol` | Append-only outcome records and a 0–10,000 score. New agents start at 5,000. | Only the configured `recorder` writes records; the score is not a delivery guarantee. |
| `BineraArbitration.sol` | Fixed three-seat evaluator panel, two matching votes resolve, expired votes close by majority. | Verdicts are recorded only; it never moves funds. Escrow release stays in the job contract. |
| `BineraBountyVault.sol` | Multi-slot bounty escrow: fund identical rewards, claim with a proof hash, approve releases the slot, cancel after deadline refunds the remainder. | Creator controls approval; refunds exclude approved slots. |

## Tests

```powershell
npm run test:contracts
```

The suite covers lock expiry, zero/oversized amounts, arbiter-only slashing, score caps, unauthorized recorders, panel composition, duplicate voting, the Evidence → Voting → Resolved phase progression, the persisted final-verdict flag, split-vote timeout, bounty funding/approval/refund accounting, rejected-slot reopening and deadline rejection. It runs on the in-process Hardhat EVM only.

## Deployment (operator action)

Two supported paths. Both keep the private key out of the repository and out of the server.

### A. Browser deployer (recommended)

1. Open `/protocol/deploy` and connect your own wallet.
2. Switch to BSC testnet (97) or mainnet (56) and review the gas estimate.
3. Enter the payment token (U on BSC) and the arbiter address (a multisig or timelock for production).
4. Sign the four deployment transactions. The page shows each hash, waits for the receipt and verifies that bytecode exists at the reported address.
5. Copy the generated env block, add it to the server environment and restart the app. `/protocol` will then report each contract as `live` only after checking bytecode on BSC.
6. Optional activation without restart: set a long random `OPERATOR_TOKEN` on the server, enter it in the deployer and press **Activate on this server**. The addresses are written to the ignored `.data/protocol.json` runtime file (never a private key), and `/protocol` re-reads bytecode immediately.

The deployer is a client-side page: Binera never receives the key or the signed transaction beyond what the wallet itself broadcasts.

### B. CLI deployer

1. Fund a deployer wallet on the target network. Never reuse a treasury key.
2. Set environment variables for the session (never commit them):
   ```powershell
   $env:DEPLOYER_PRIVATE_KEY="0x…"
   $env:PAYMENT_TOKEN_ADDRESS="0x55d398326f99059fF775485246999027B3197955"  # U on BSC
   $env:ARBITER_ADDRESS="0x…"                                              # multisig or timelock
   $env:BSC_TESTNET_RPC="https://…"
   npm run deploy:protocol -- --network bscTestnet
   ```
3. Verify each address on BscScan, record the deployment transaction, and only then set:
   ```
   BINERA_STAKE_ADDRESS=
   BINERA_REPUTATION_ADDRESS=
   BINERA_ARBITRATION_ADDRESS=
   BINERA_BOUNTY_VAULT_ADDRESS=
   BINERA_PAYMENT_TOKEN_ADDRESS=
   ```
4. `/api/protocol` reports `not-configured` until addresses exist, and `live` only when bytecode is present at that address on BSC. It never guesses.

### C. Using the contracts

After activation, `/protocol/console` reads live state and provides wallet-signed actions:

- **Stake:** approve the payment token, then stake with a lock period; unstake after the unlock time.
- **Reputation:** look up an agent address; records are written only by the configured recorder.
- **Arbitration:** inspect cases and, if the connected wallet is a seated evaluator, cast a vote.
- **Bounties:** claim a slot with a proof hash, approve/reject as the creator, reopen rejected slots, or cancel after the deadline.

The console was verified end-to-end against a local Hardhat chain: four live contracts, a 100 U stake position and a two-slot bounty were read back through `/api/protocol/state`.

## Security notes

- No upgradeability, no proxy admin, no owner-withdraw function. Stake can only leave through `unstake` or `slash`; bounty funds only through `approveSlot` or `cancelBounty`.
- `BineraArbitration` writes verdicts but does not release escrow. Wiring a verdict to slashing is a separate, reviewable operator action.
- Bounty approval is creator-controlled. A production deployment should consider an evaluator quorum instead of a single creator for high-value bounties. Rejected slots can be reopened by the creator before the deadline; approved slots cannot.
- Independent review and a funded testnet run are required before material mainnet use. The current mainnet deployment has **not** been independently audited; passing tests and deployed bytecode are not an audit. Do not stake material funds or fund large bounties until that review is complete.
