import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { isAddress } from "viem";

const strict = process.argv.includes("--strict");
const file = process.env.ENV_FILE || ".env.local";
let fileEnv: Record<string, string>;
try { fileEnv = parse(readFileSync(file)); }
catch { console.error(`Cannot read ${file}. Create it from .env.example first.`); process.exit(1); }
const env = { ...fileEnv, ...process.env };

type Check = { group: string; key: string; required: boolean; check: (value: string) => boolean; hint: string };
const hexKey = (value: string) => /^0x[0-9a-f]{64}$/i.test(value);
const httpUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } };
const httpsUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" || (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(value)); } catch { return false; } };

const checks: Check[] = [
  { group: "Core", key: "APP_ORIGIN", required: true, check: httpUrl, hint: "absolute URL, e.g. https://binera.xyz" },
  { group: "Core", key: "BSC_RPC_URL", required: false, check: value => !value || httpsUrl(value), hint: "HTTPS RPC endpoint" },
  { group: "Core", key: "SCAN_API_KEY", required: false, check: () => true, hint: "optional 8004scan quota key" },
  { group: "Core", key: "OPENAI_API_KEY", required: false, check: () => true, hint: "optional intent model key" },
  { group: "Protocol", key: "DEPLOYER_PRIVATE_KEY", required: true, check: hexKey, hint: "32-byte hex key for a funded testnet deployer wallet" },
  { group: "Protocol", key: "MAINNET_DEPLOYER_PRIVATE_KEY", required: false, check: value => !value || hexKey(value), hint: "separate funded mainnet deployer; used only for --network bsc" },
  { group: "Protocol", key: "ARBITER_ADDRESS", required: true, check: isAddress, hint: "BSC address (multisig/timelock for production)" },
  { group: "Protocol", key: "PAYMENT_TOKEN_ADDRESS", required: true, check: isAddress, hint: "ERC-20 used for stake/bounties" },
  { group: "Protocol", key: "OPERATOR_TOKEN", required: true, check: value => value.length >= 32, hint: "random 32+ characters" },
  { group: "Protocol", key: "EXCHANGE_WEBHOOK_URL", required: false, check: value => !value || httpsUrl(value), hint: "HTTPS endpoint (localhost HTTP allowed for tests)" },
  { group: "Protocol", key: "EXCHANGE_WEBHOOK_SECRET", required: false, check: value => !value || value.length >= 32, hint: "random 32+ characters when a webhook is set" },
  { group: "Seller", key: "SELLER_PRIVATE_KEY", required: false, check: value => !value || hexKey(value), hint: "provider wallet registered on ERC-8004" },
  { group: "Seller", key: "SELLER_BASE_URL", required: false, check: value => !value || httpsUrl(value), hint: "public HTTPS origin" },
  { group: "Seller", key: "SELLER_PRICE", required: false, check: value => !value || (/^\d{1,78}$/.test(value) && BigInt(value) > 0n), hint: "integer base units" },
];

const problems: string[] = [];
let ready = true;
console.log(`Environment preflight: ${file}\n`);
let group = "";
for (const check of checks) {
  if (check.group !== group) { group = check.group; console.log(`[${group}]`); }
  const value = env[check.key]?.trim() ?? "";
  const required = check.required;
  if (!value) {
    if (required) { ready = false; problems.push(`${check.key} is required`); console.log(`  - ${check.key}: MISSING (required) — ${check.hint}`); }
    else console.log(`  - ${check.key}: not set (optional) — ${check.hint}`);
    continue;
  }
  const valid = check.check(value);
  if (!valid) { ready = false; problems.push(`${check.key} is invalid`); console.log(`  - ${check.key}: INVALID (value hidden) — ${check.hint}`); }
  else console.log(`  - ${check.key}: ok (value hidden)`);
}

// Contract addresses are optional; validate only when present.
for (const key of ["BINERA_STAKE_ADDRESS", "BINERA_REPUTATION_ADDRESS", "BINERA_ARBITRATION_ADDRESS", "BINERA_BOUNTY_VAULT_ADDRESS", "BINERA_PAYMENT_TOKEN_ADDRESS"]) {
  const value = env[key]?.trim() ?? "";
  if (value && !isAddress(value)) { ready = false; problems.push(`${key} is invalid`); console.log(`  - ${key}: INVALID (value hidden)`); }
}

if (env.DEPLOYER_PRIVATE_KEY && env.SELLER_PRIVATE_KEY && env.DEPLOYER_PRIVATE_KEY.toLowerCase() === env.SELLER_PRIVATE_KEY.toLowerCase()) {
  console.log("\nWARNING: deployer and seller use the same private key. Use separate wallets.");
}

try { execFileSync("git", ["check-ignore", "-q", file], { stdio: "ignore" }); console.log("\nGit: file is ignored (safe)."); }
catch { ready = false; problems.push(`${file} is not gitignored`); console.log(`\nWARNING: ${file} is NOT gitignored. Fix .gitignore before adding keys.`); }

if (process.platform === "win32") {
  try {
    const acl = execFileSync("icacls", [file], { encoding: "utf8" });
    if (/Everyone|BUILTIN\\Users|Authenticated Users/i.test(acl)) console.log("ACL: broad user access detected. Restrict the file to your account, SYSTEM and Administrators.");
    else console.log("ACL: restricted to the current account, SYSTEM and Administrators.");
  } catch { /* ACL check is best effort. */ }
}

console.log(`\nDeployment readiness: ${ready ? "READY for the configured steps" : "INCOMPLETE"}`);
if (problems.length) console.log(`Items: ${problems.join("; ")}`);
console.log("Values are intentionally never printed. Add keys directly to the file, not to the terminal.");

if (strict && !ready) process.exit(1);
if (ready) process.exit(0);
