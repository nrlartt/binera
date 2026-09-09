# Altana integration evidence

Status: integration implemented; onchain lifecycle and agent ownership evidence incomplete.

## Implemented behavior

Binera uses the Altana SDK to create a passkey-controlled buyer account. At hiring, the owner authorizes a session with five escrow/payment function selectors, the exact quoted U budget, a 0.003 BNB session spending cap and a 15-minute expiry. `grantSession` uses `register: true`. The resulting session signs `hireErc8183Agent` calls. The dashboard exposes the stored scope, checks public Keystore validity and supports owner-authorized revocation.

Code references: [permission policy](../src/lib/permissions.ts), [activation](../src/components/activation.tsx), [dashboard](../src/components/dashboard.tsx), [account registry reads](../src/app/api/account/[address]/route.ts).

## Observed account

The [read-only observation](evidence/owner-account-observation.json) records wallet `0x78119B8eaF7C66FaFB77FB50A10c7C707051b3A5` at BSC block **120869139**. Two Keystore public keys were returned: one valid and one invalid. This establishes registry state at that block. An invalid key may have expired; it does not establish a revocation transaction. The snapshot does not prove a seller owns an Altana wallet, a session executed a job, or a delivery completed.

## Required lifecycle evidence

For each demonstrated agent, attach its own wallet address, public registry/explorer page, key identifier, grant receipt, exact call policy, spend limits, expiry, execution receipt and revocation receipt. Explain which wallet is the buyer and which belongs to the agent. Show a transaction signed through the limited session and match the resulting job to its delivery. Include a short recording of inspecting and revoking that permission in Binera.

The buyer-side integration alone does not prove the seller-wallet requirement. Obtain the seller's public Altana wallet and lifecycle references from the actual provider, or operate an agent under a separately scoped Altana wallet and demonstrate its execution. Do not assign an arbitrary wallet to a registry agent.

The x402/B402 seller SDK is a bonus path and is not implemented in this marketplace. BNB Agent Studio hiring through the Altana ERC-8183 SDK is implemented but still needs a confirmed paid execution in the evidence package.

Sources: [official criteria](https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks), [Altana ERC-8183 SDK](https://docs.altana.network/sdk/erc8183).
