# PancakeSwap benefit report

Status: real input observation available; paid agent output and measured user benefit pending.

## Reproducible input

[Raw snapshot](evidence/pancake-input-snapshot.json), BNB Smart Chain block **120869141**, timestamp **2026-09-09T11:20:02Z**:

- Pool: `0x36696169C63e42cd08ce11f5deeBbCeBae652050`
- Pair: WBNB/USDT, PancakeSwap v3, 0.05% fee tier
- Observed spot price: approximately 748.553 USDT/WBNB
- Tick: -66185

This is an observed input, not a swap quote, an APR estimate or proof of benefit. Pool balances must not be interpreted as active liquidity or expected yield.

## Task to run through Binera

> Research the PancakeSwap v3 WBNB/USDT pool at 0x36696169C63e42cd08ce11f5deeBbCeBae652050 on BNB Chain. Use the attached block-120869141 snapshot as the comparison baseline; distinguish any fresh data. For a hypothetical 1,000 USDT research budget and a 7-day horizon, compare a narrow and wide LP range. Explain token ordering, tick/range assumptions, fee tier, out-of-range exposure, impermanent loss, estimated operational costs and unavailable inputs. Do not move funds or present estimated yield without supporting volume and liquidity data. Return sources and a decision checklist.

Use the same prompt and input for an independent manual analysis before reading the agent output. This task can also serve as one of the three paired TermiX experiments.

## Evidence to attach

1. Binera job ID, signed terms, buyer/provider addresses and confirmed funding receipt.
2. Original delivery manifest whose bytes match the onchain commitment.
3. Independent manual output, timestamps and external costs.
4. Reviewer scores for factual accuracy, sources, task coverage, cost/risk treatment and usefulness (0–4 each).
5. Measured difference in total elapsed time and human effort, with errors and retries included.

Claim only what the completed comparison supports: for example, a faster sourced assessment or clearer range-risk analysis. This research flow does not establish automated liquidity management, realized profit or risk-free swaps.

Source: [PancakeSwap challenge criteria](https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks).
