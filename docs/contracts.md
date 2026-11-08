# On-chain protocol contracts

Four Solidity contracts back the remaining marketplace primitives that an off-chain index cannot enforce. They are written and tested against the local Hardhat EVM. **They are not deployed anywhere yet.** No UI reads them until operator addresses are configured, so no fake on-chain state is shown.

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

## Security notes

- No upgradeability, no proxy admin, no owner-withdraw function. Stake can only leave through `unstake` or `slash`; bounty funds only through `approveSlot` or `cancelBounty`.
- `BineraArbitration` writes verdicts but does not release escrow. Wiring a verdict to slashing is a separate, reviewable operator action.
- Bounty approval is creator-controlled. A production deployment should consider an evaluator quorum instead of a single creator for high-value bounties. Rejected slots can be reopened by the creator before the deadline; approved slots cannot.
- Independent review and a funded testnet run are required before mainnet use. Passing tests here is not an audit.
