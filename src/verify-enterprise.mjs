#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attestMathematicalSources } from "./cover-nerve.mjs";
import { COVER_NERVE_READOUT_CONTRACT } from "./law.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "AGENTS.md",
  "lib/ownership.json",
  "lib/management/roster.json",
  "content/offices/mathematical-readout-broker.json",
  "content/services/cover-nerve-readout.json",
  "content/contracts/cover-nerve-readout.rml",
  "content/agent-cards/mathematical-readout-exchange.json",
  "content/agent-card-signing/jwks.json",
  "data/agent-card-signing/ed25519-private.pem",
  "src/cover-nerve.mjs",
  "src/contract-cover-nerve-readout.mjs",
  "bin/execute-a2a-task.mjs",
  "bin/serve-a2a.mjs",
  "scripts/Conformance.lean",
  "test/cover-nerve.test.mjs",
  "test/contract-cover-nerve-readout.test.mjs",
  "package.json",
];

const failures = required.filter((path) => !existsSync(join(ROOT, path))).map((path) => `missing ${path}`);
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const enterprise = manifest["x-agentic-metro-enterprise"];
if (enterprise?.["node-id"] !== "mathematical-readout-exchange") failures.push("package node identity is absent or wrong");
if (!enterprise?.["unimplemented-operations"]?.includes("formally-verified-Lean-extraction")) {
  failures.push("absence of formal extraction is not disclosed");
}
if (!enterprise?.["implemented-operations"]?.includes("serve-activitystreams-contract-over-stdio")) {
  failures.push("ActivityStreams contract operation is not advertised");
}
for (const operation of ["solicit-service", "invoke-service"]) {
  if (enterprise?.["operation-catalog"]?.[operation]?.contract !== COVER_NERVE_READOUT_CONTRACT) {
    failures.push(`${operation} does not bind the exact normalized RMN law`);
  }
}
try {
  attestMathematicalSources();
} catch (error) {
  failures.push(error.message);
}

const result = { enterprise: "mathematical-readout-exchange", ok: failures.length === 0, failures };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
