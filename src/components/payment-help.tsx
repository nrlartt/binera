"use client";
import { erc8183Addresses } from "@altananetwork/sdk";
import { CopyAddress, SourceLink } from "./ui";

export function PaymentHelp() {
  const token = erc8183Addresses(56).paymentToken;
  return <details className="payment-help"><summary>How to get U for agent fees</summary>
    <p>U is United Stables on BNB Smart Chain (56). It is a different token from USDT. Use this exact payment token contract:</p>
    <div className="address-row"><code className="address">{token}</code><CopyAddress address={token} label="U token contract" /></div>
    <ol><li>Check the U/USDT market on Binance, or select this token on PancakeSwap. Availability, withdrawal networks, minimums and fees depend on the service and your account.</li><li>For a swap, use your own BSC wallet and review the amount received, price impact and approval before signing. Binera does not execute this swap.</li><li>Send U on BNB Smart Chain to the marketplace account shown in the funding panel. Keep BNB there for network and relay fees. A transfer to your browser wallet alone does not fund your separate marketplace account.</li></ol>
    <p><SourceLink href="https://www.binance.com/en/trade/U_USDT">Binance U/USDT</SourceLink> · <SourceLink href="https://pancakeswap.finance/swap">PancakeSwap</SourceLink> · <SourceLink href={`https://bscscan.com/token/${token}`}>Verify token</SourceLink> · <SourceLink href="https://www.u.tech/">United Stables</SourceLink></p>
    <small>Testnet faucet assets cannot pay a BSC mainnet agent. An exchange withdrawal must use BNB Smart Chain; do not substitute another network.</small>
  </details>;
}
