# Agent Advantage Report — experiment plan, not completed results

Status: NOT RUN. Do not submit this plan as measured advantage.

Run each task using an agent hired through Binera Agent Market and independently without an agent, with the same input data/time window. Preserve full prompts, timestamps, outputs, sources, job IDs and receipts. Report unsuccessful runs as well as successes. Define quality criteria before seeing either output.

| Task | Suggested scope | Agent ID / job | Agent elapsed time / cost | Baseline elapsed time / cost | Quality rubric / scores | Actual output links |
| --- | --- | --- | --- | --- | --- | --- |
| Trading research | BNB/USDT grid feasibility, costs and downside scenarios | NOT RUN | NOT MEASURED | NOT MEASURED | Correct assumptions, cited evidence, fee accounting and unsupported claims | MISSING |
| Yield research | Compare available USDT options with costs, constraints and observed time | NOT RUN | NOT MEASURED | NOT MEASURED | Comparable assumptions, source freshness, fee accounting, risk disclosure | MISSING |
| LP research | PancakeSwap position/range research using actual pool/position data | NOT RUN | NOT MEASURED | NOT MEASURED | Correct input facts, fee/range assumptions, actionable sourced result | MISSING |

Include network fees and failed attempts in costs. Distinguish task price from any investment capital. Compare quality using the same rubric and name the reviewer. A faster incorrect answer is not a positive result. Where market data differs between runs, disclose that limitation. No savings, returns, win rate or score is pre-filled.

For each trial append: UTC start/end; input snapshot/block; raw output URL; task price; network costs; quality score and rationale; error/retry notes; signed quote hash; agent/job/source URLs; whether the trial completed. Include an interpretation of the measured differences without extrapolating short trials into investment performance.

Source: [TermiX competition requirements](https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks).

## Execution cards

Freeze the input snapshot before either run. Suggested identities must pass a fresh availability and quote check. Run the independent baseline before reading the agent output.

### T1: Trading research

Provider candidate: `scan-56-269224` (Grid Trader).

> Research a BNB/USDT grid on BNB Chain for a hypothetical 1,000 USDT budget and a 7-day horizon. Use the supplied timestamped market snapshot. Compare two range assumptions, account for trading and network fees, explain inventory exposure and what happens outside the range, and list conditions under which no grid should be started. Cite sources and separate observations from assumptions. Do not place orders or invent backtest performance.

This demonstrates trading research only; it does not establish a win rate or execution record.

### T2: Yield research

Provider candidate: `scan-56-341225`.

> Compare USDT yield options on BNB Chain for a hypothetical 1,000 USDT budget over 30 days. Use the same timestamped input sources supplied to the independent reviewer. Explain withdrawal constraints, fee assumptions, source dates and material risks. Mark unavailable APR or safety evidence explicitly. Do not deposit funds or present projected returns as guaranteed.

### T3: PancakeSwap LP research

Provider candidate: `scan-56-265375`. Use the exact task and snapshot in [PancakeSwap benefit report](pancakeswap-benefit-report.md). Preserve the baseline block and identify subsequent data refreshes separately.

## Record for each pair

Copy this record for T1, T2 and T3. Empty fields mean unmeasured, never zero.

- Task ID, frozen input file and SHA-256:
- Baseline operator and reviewer:
- Baseline start/finish UTC and human effort minutes:
- Baseline output file and external costs with units:
- Agent ID, job ID, funding receipt and original delivery manifest:
- Agent start/verified delivery UTC and human effort minutes:
- Agent fee U, actual user-paid network/relay BNB costs and failed attempts:
- Baseline five quality scores (0–4) and rationale:
- Agent five quality scores (0–4) and rationale:
- Critical errors, missing data and differences in source access:
- Elapsed-time difference (baseline minus agent):
- Supported conclusion, including negative outcomes:

No paired runs have been supplied. These cards prepare the experiment; they are not completed results.

## Predefined measurement protocol

Before starting each pair, freeze the question, token/pool address, chain ID, block or market window, expected output and reviewer. Use the same source access for both runs and disclose differences. Run the baseline independently, without copying the agent output. Use separate UTC start/end timestamps for each run; include waiting, retries and verification time. Record human minutes separately from total elapsed minutes.

Score both outputs on five dimensions from 0 to 4: factual correctness, source traceability/freshness, completeness against the task, cost/risk accounting, and usefulness of the proposed next step. 0 = absent or materially wrong; 2 = partial with gaps; 4 = complete and supported. Preserve the reviewer's rationale for each score; a total out of 20 is a local rubric, not the organizer's score. Mark critical errors separately even when the total is high.

Report cost as paid U plus network fees in BNB and any external service fees. If converting to USD, attach the rate source and timestamp. Include failed attempts. Report elapsed-time difference as baseline minutes minus agent minutes; percentage only when baseline time is positive. Show negative results without excluding them. No cost or time is automatically assumed to be zero.

For the PancakeSwap trial, keep the pool address and observed block with both outputs. Check that token order, decimal units, range assumptions and fee tier are correct. Compare the time and evidence required to understand that real LP decision; do not extrapolate a research report into guaranteed returns or live position management.
