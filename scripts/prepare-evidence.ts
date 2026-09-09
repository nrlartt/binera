import { readFile, stat, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { prepareEvidence } from "../src/lib/release-evidence";

try {
  const { values } = parseArgs({ options: { input: { type: "string" }, job: { type: "string" }, category: { type: "string" }, output: { type: "string" } } });
  if (!values.input || !values.job || !values.category) throw new Error("Usage: npm run prepare:evidence -- --input <export.json> --job <jobId> --category <rebalancing|grid|yield|health> [--output <new-file.json>]");
  if ((await stat(values.input)).size > 5_000_000) throw new Error("Choose a public activity export smaller than 5 MB.");
  const draft = prepareEvidence(JSON.parse(await readFile(values.input, "utf8")), values.job, values.category);
  const output = values.output || `submission/evidence/job-${draft.jobId}.draft.json`;
  await writeFile(output, JSON.stringify(draft, null, 2) + "\n", { flag: "wx" });
  console.log(`Draft saved to ${output}. No existing file or release manifest was changed.`);
  console.log("This is not completed-job evidence. Set outputUrl to the original deliverable manifest (or a byte-identical HTTPS copy), review category/service claims, then add the object to release.json categoryEvidence and run check:release. Receipt-to-job semantics and output quality still require human review.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to prepare evidence.");
  process.exitCode = 1;
}
