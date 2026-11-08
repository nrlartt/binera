import { test } from "node:test";
import assert from "node:assert/strict";
import { estimatedChainTime, formatDuration, jobWindows, windowStatusLabel } from "../src/lib/job-windows";
import { nextJobStep } from "../src/lib/job-match";

test("formatDuration keeps every unit readable", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(-5), "0s");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(125), "2m 5s");
  assert.equal(formatDuration(3 * 3600 + 61), "3h 1m");
  assert.equal(formatDuration(2 * 86400 + 3600), "2d 1h");
  assert.equal(formatDuration(Number.NaN), "0s");
});

test("a funded job exposes its delivery window and no dispute window yet", () => {
  const windows = jobWindows({ statusName: "FUNDED", submittedAt: 0n, expiredAt: 1000n, disputeWindow: 600n }, 400n);
  assert.equal(windows[0].id, "delivery");
  assert.equal(windows[0].state, "open");
  assert.equal(windows[0].secondsLeft, 600);
  assert.equal(windows[1].state, "not-applicable");
  assert.equal(windowStatusLabel(windows[0]), "10m 0s left");
});

test("an expired delivery window is closed and never reports time remaining", () => {
  const windows = jobWindows({ statusName: "FUNDED", submittedAt: 0n, expiredAt: 900n, disputeWindow: 600n }, 1000n);
  assert.equal(windows[0].state, "closed");
  assert.equal(windowStatusLabel(windows[0]), "Closed");
});

test("a submitted job replaces the delivery window with its dispute window", () => {
  const windows = jobWindows({ statusName: "SUBMITTED", submittedAt: 2000n, expiredAt: 1000n, disputeWindow: 600n }, 2100n);
  assert.equal(windows[0].state, "done");
  assert.equal(windows[0].label, "Delivery submitted");
  assert.equal(windows[1].state, "open");
  assert.equal(windows[1].secondsLeft, 500);
});

test("a submitted job past its dispute window exposes a closed dispute", () => {
  const windows = jobWindows({ statusName: "SUBMITTED", submittedAt: 2000n, expiredAt: 1000n, disputeWindow: 600n }, 3000n);
  assert.equal(windows[1].state, "closed");
  assert.equal(windowStatusLabel(windows[1]), "Closed");
});

test("unknown chain data stays not-applicable instead of inventing deadlines", () => {
  const windows = jobWindows({ statusName: "OPEN", submittedAt: 0n, expiredAt: 0n, disputeWindow: 0n }, 500n);
  assert.deepEqual(windows.map(w => w.state), ["not-applicable", "not-applicable"]);
  assert.deepEqual(windows.map(w => w.endsAt), [null, null]);
});

test("chain time is anchored to the observed block rather than the device clock", () => {
  const observedAt = "2026-11-08T00:00:00.000Z";
  const chainAtObservation = 1_700_000_000n;
  const fiveSecondsLater = Date.parse(observedAt) + 5_000;
  assert.equal(estimatedChainTime(chainAtObservation, observedAt, fiveSecondsLater), chainAtObservation + 5n);
  assert.equal(estimatedChainTime(chainAtObservation, "not-a-date", fiveSecondsLater), chainAtObservation);
  assert.equal(estimatedChainTime(chainAtObservation, observedAt, Date.parse(observedAt) - 60_000), chainAtObservation);
});

test("next-step copy is derived from the same action rules as the job", () => {
  const delivered = { statusName: "SUBMITTED", submittedAt: 1_000n, expiredAt: 2_000n };
  assert.match(nextJobStep(delivered, 1_100n, 500n, true), /before the dispute window closes/i);
  assert.match(nextJobStep(delivered, 1_600n, 500n, true), /settle the job/i);
  assert.match(nextJobStep(delivered, 1_100n, 500n, false), /not verified/i);
  assert.match(nextJobStep(null, 0n, 0n, false), /payment submission/i);
  assert.match(nextJobStep({ statusName: "FUNDED", submittedAt: 0n, expiredAt: 900n }, 1_000n, 500n, false), /refund/i);
});
