#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { attestCoverNerveSources } from "@lenticule-science/cover-nerve-rank-readout-service";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "lib/ownership.json",
  "lib/management/roster.json",
  "content/offices/mathematical-readout-broker.json",
  "content/agent-cards/mathematical-readout-exchange.json",
  "content/agent-card-signing/jwks.json",
  "data/agent-card-signing/ed25519-private.pem",
  "src/relational-graph-protocol.mjs",
  "scripts/execute-a2a-task.mjs",
  "scripts/serve-a2a.mjs",
  "package.json",
];

const failures = required.filter((path) => !existsSync(join(ROOT, path))).map((path) => `missing ${path}`);
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const enterprise = manifest["x-agentic-metro-enterprise"];
if (enterprise?.["node-id"] !== "mathematical-readout-exchange") failures.push("package node identity is absent or wrong");
if (!enterprise?.["unimplemented-operations"]?.includes("formally-verified-Lean-extraction")) {
  failures.push("absence of formal extraction is not disclosed");
}
if (enterprise?.["operation-catalog"]?.["obsmetrologia.relationalGraph.readout"]?.transport !== "a2a-1.0-rmn-cbor") {
  failures.push("normalized relational-graph A2A operation is not advertised");
}
try {
  attestCoverNerveSources();
} catch (error) {
  failures.push(error.message);
}

const result = { enterprise: "mathematical-readout-exchange", ok: failures.length === 0, failures };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
