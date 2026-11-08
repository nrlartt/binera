# Environment setup (operator)

`.env.local` is ready. It is gitignored and its Windows ACL is restricted to your account, SYSTEM and Administrators. **Never paste a private key into chat, a commit, a screenshot or a shell command.** Add it directly inside the file with a text editor.

## What you must fill

| Variable | Purpose | Notes |
| --- | --- | --- |
| `DEPLOYER_PRIVATE_KEY` | Deploys the four protocol contracts | Use a dedicated funded wallet; never a treasury key |
| `ARBITER_ADDRESS` | Can slash stake after arbitration | Multisig/timelock for production; deployer is fine on testnet |
| `SELLER_PRIVATE_KEY` | Signs quotes and deliveries for `npm run seller` | Must be the ERC-8004 payment wallet of your agent |
| `SELLER_BASE_URL` | Public HTTPS origin of the seller | e.g. `https://seller.example` |
| `BSC_RPC_URL` | Read/write RPC | A keyed provider is recommended |
| `SCAN_API_KEY` | Optional 8004scan quota | Server-only |
| `OPENAI_API_KEY` | Optional intent extraction | Ranking stays deterministic |

Already generated for you (do not print or reuse elsewhere): `OPERATOR_TOKEN` and `EXCHANGE_WEBHOOK_SECRET`. Leave them as they are unless you rotate them.

## Verify without revealing values

```powershell
npm run check:env          # report missing/invalid; never prints values
npm run check:env:strict   # exits non-zero until deployment values are valid
```

The check also confirms that `.env.local` is gitignored and that its ACL is not broadly readable.

## Recommended flow

1. Create a **dedicated** wallet for deployment and fund it with a small amount of testnet BNB from https://www.bnbchain.org/en/testnet-faucet.
2. Put its key in `DEPLOYER_PRIVATE_KEY`; set `ARBITER_ADDRESS` (deployer address is acceptable for a first testnet run).
3. `npm run check:env:strict`.
4. `npm run deploy:protocol -- --network bscTestnet`.
5. Verify each address on BscScan, then either:
   - open `/protocol/deploy` and press **Activate on this server** with the operator token, or
   - paste the `BINERA_*` addresses into `.env.local` and restart.
6. `/protocol` must show `live` only after bytecode is found. Do not proceed to mainnet until a funded dispute and bounty scenario has run on testnet.
7. For selling, register the agent on ERC-8004 with `SELLER_PRIVATE_KEY`'s address as its payment wallet, set `SELLER_BASE_URL` to a public HTTPS origin, then `npm run seller`.
8. Production: change `APP_ORIGIN` to `https://binera.xyz`, keep `.env.local` out of the image, inject the same variables through the host's secret manager, and mount a persistent volume for `MARKETPLACE_DB_PATH`.

## Security rules

- Separate wallets for deployer, seller and personal funds.
- Use testnet first. A leaked testnet key is still a leak: rotate it.
- `OPERATOR_TOKEN` protects activation only; it never authorises transfers.
- The server never needs a user passkey or a buyer's key. Seller/deployer keys are only read by the relevant local process.
- If a key ever appears in terminal history, a screenshot or a commit, rotate it immediately and revoke the old permissions.
- Back up `.env.local` in a password manager, not in the repository or cloud notes.
