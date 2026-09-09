# Submission package

Current production domain: https://binera.xyz. The original Railway domain remains available for its domain-bound passkeys.

Prepared evidence materials: [Altana](altana-evidence.md), [PancakeSwap](pancakeswap-benefit-report.md), [owner steps and Railway settings](../docs/partner-completion-tr.md).

Run `npm run collect:evidence -- --input <activity.json> --mapping <job-categories.json>` to verify completed jobs and delivery commitments from a public activity export. The tool writes candidates without changing the release manifest or signing transactions. Account and pool observations do not substitute for paid delivery or paired measurements.

Status: **NOT READY FOR FINAL SUBMISSION** until paid evidence and reviewer access are supplied. [Binera Agent Market is deployed on Railway](https://binera-production.up.railway.app); application and dependency health checks passed on September 9, 2026. The GitHub repository is currently private. The application has passing automated checks and live signed quotes, not completed paid jobs.

- [English description](project-description.md): truthful text for the form.
- [Owner launch guide (Turkish)](../docs/owner-launch-guide-tr.md): credentials, domain, wallet, evidence and form steps.
- [Service audit](evidence/service-audit.json): bounded live observations, including failures and rate-limit uncertainty.
- [Release manifest](release.json): enter real URLs and job/receipt evidence.
- [Release check](evidence/release-check.json): outstanding gates.
- [Agent Advantage experiment plan](agent-advantage-report.md): needs real paired measurements and outputs.

## Observed signed quotes

These are time-stamped observations. Prices expire; fetch a fresh quote before payment. Research terms are not proof of automated strategy execution. The audit includes an explicit recheck of the grid provider after a rate-limit response; each record has its own observation time.

| Category | Published name | Registry ID | Observed quote | Quote observed (UTC) | Paid outcome |
| --- | --- | --- | --- | --- | --- |
| rebalancing | BNB LP Range Rebalancer | scan-56-265375 | 0.1 U | 2026-09-09T00:56:59.934Z | NOT TESTED |
| grid | Grid Trader | scan-56-269224 | 0.5 U | 2026-09-09T00:58:25.874Z | NOT TESTED |
| yield | yieldrouter â€” capacity-aware yield optimisation | scan-56-341225 | 0.1 U | 2026-09-09T00:57:01.085Z | NOT TESTED |
| health | Health Factor Monitor | scan-56-269228 | 0.5 U | 2026-09-09T00:57:01.918Z | NOT TESTED |

All four category research prompts obtained a seller-signed quote. This does not verify delivery quality, LP rebalancing, live grid orders, yield routing or liquidation protection. No invented outcomes or success metrics are included.

The default release checker asks for a completed delivered job per category as an engineering readiness threshold. It cannot independently prove that a successful receipt belongs to that job or that a session executed within intended limits; an evidence reviewer must inspect those links. It is not an organizer eligibility decision.
