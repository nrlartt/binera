import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeDeployData, type Abi } from "viem";
import { contractArtifacts } from "../src/lib/contracts/artifacts";

const token = "0x55d398326f99059fF775485246999027B3197955" as const;
const arbiter = "0x1111111111111111111111111111111111111111" as const;
const deployer = "0x2222222222222222222222222222222222222222" as const;

test("every shipped contract artifact has ABI and bytecode", () => {
  for (const [name, artifact] of Object.entries(contractArtifacts)) {
    assert.ok(Array.isArray(artifact.abi) && artifact.abi.length > 0, `${name} ABI`);
    assert.match(artifact.bytecode, /^0x[0-9a-f]+$/i, `${name} bytecode`);
    assert.ok(artifact.bytecode.length > 2000, `${name} bytecode size`);
  }
});

test("deployment calldata can be built for all four contracts", () => {
  const cases = [
    ["BineraStake", [token, arbiter]],
    ["BineraReputation", [deployer]],
    ["BineraArbitration", []],
    ["BineraBountyVault", [token]],
  ] as const;
  for (const [name, args] of cases) {
    const artifact = contractArtifacts[name];
    const data = encodeDeployData({ abi: artifact.abi as Abi, bytecode: artifact.bytecode as `0x${string}`, args });
    assert.match(data, /^0x[0-9a-f]+$/i);
    assert.ok(data.length > 2000, `${name} calldata`);
  }
});
