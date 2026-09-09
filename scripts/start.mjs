import { cp, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const root = process.cwd();
await mkdir(resolve(root, ".next/standalone/.next"), { recursive: true });
await cp(resolve(root, ".next/static"), resolve(root, ".next/standalone/.next/static"), { recursive: true });
const child = spawn(process.execPath, [resolve(root, ".next/standalone/server.js")], { stdio: "inherit", windowsHide: true, env: { ...process.env, HOSTNAME: process.env.HOSTNAME || "127.0.0.1", PORT: process.env.PORT || "3000" } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
