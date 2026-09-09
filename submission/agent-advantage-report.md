# Agent Advantage Report — experiment plan, not completed results

Status: NOT RUN. Do not submit this plan as measured advantage.

Run each task using an agent hired through Binera Agent Market and independently without an agent, with the same input data/time window. Preserve full prompts, timestamps, outputs, sources, job IDs and receipts. Report unsuccessful runs as well as successes. Define quality criteria before seeing either output.

| Task | Suggested scope | Agent ID / job | Agent elapsed time / cost | Baseline elapsed time / cost | Quality rubric / scores | Actual output links |
| --- | --- | --- | --- | --- | --- | --- |
| Security | Token contract risk review on BSC, sourced findings and explicit unknowns | NOT RUN | NOT MEASURED | NOT MEASURED | Correct findings, cited evidence, missed critical issues, unsupported claims | MISSING |
| Yield research | Compare available USDT options with costs, constraints and observed time | NOT RUN | NOT MEASURED | NOT MEASURED | Comparable assumptions, source freshness, fee accounting, risk disclosure | MISSING |
| LP research | PancakeSwap position/range research using actual pool/position data | NOT RUN | NOT MEASURED | NOT MEASURED | Correct input facts, fee/range assumptions, actionable sourced result | MISSING |

Include network fees and failed attempts in costs. Distinguish task price from any investment capital. Compare quality using the same rubric and name the reviewer. A faster incorrect answer is not a positive result. Where market data differs between runs, disclose that limitation. No savings, returns, win rate or score is pre-filled.

For each trial append: UTC start/end; input snapshot/block; raw output URL; task price; network costs; quality score and rationale; error/retry notes; signed quote hash; agent/job/source URLs; whether the trial completed. Include an interpretation of the measured differences without extrapolating short trials into investment performance.

Source: [TermiX competition requirements](https://www.agent.family/campaigns/bnb-build-the-era).

## Predefined measurement protocol

Before starting each pair, freeze the question, token/pool address, chain ID, block or market window, expected output and reviewer. Use the same source access for both runs and disclose differences. Run the baseline independently, without copying the agent output. Use separate UTC start/end timestamps for each run; include waiting, retries and verification time. Record human minutes separately from total elapsed minutes.

Score both outputs on five dimensions from 0 to 4: factual correctness, source traceability/freshness, completeness against the task, cost/risk accounting, and usefulness of the proposed next step. 0 = absent or materially wrong; 2 = partial with gaps; 4 = complete and supported. Preserve the reviewer's rationale for each score; a total out of 20 is a local rubric, not the organizer's score. Mark critical errors separately even when the total is high.

Report cost as paid U plus network fees in BNB and any external service fees. If converting to USD, attach the rate source and timestamp. Include failed attempts. Report elapsed-time difference as baseline minutes minus agent minutes; percentage only when baseline time is positive. Show negative results without excluding them. No cost or time is automatically assumed to be zero.

For the PancakeSwap trial, keep the pool address and observed block with both outputs. Check that token order, decimal units, range assumptions and fee tier are correct. Compare the time and evidence required to understand that real LP decision; do not extrapolate a research report into guaranteed returns or live position management.
