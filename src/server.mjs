#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const SOURCES = [
  {
    declarationFile: "Obsmetrologia/Cohomology/CoordinationCohomology.lean",
    url: new URL("../../../src/services/obsmetrologia/Obsmetrologia/Cohomology/CoordinationCohomology.lean", import.meta.url),
    sha256: "6494b3f82306922978345eb22d3fab58bbc8240c3dbb62c9e2a5fc915ccd9e06",
  },
  {
    declarationFile: "Obsmetrologia/Cohomology/LandauerEntropy.lean",
    url: new URL("../../../src/services/obsmetrologia/Obsmetrologia/Cohomology/LandauerEntropy.lean", import.meta.url),
    sha256: "c681484d6f77d21c49f30f211832245dcf80184067faf8e69e946a707d933801",
  },
];

const DECLARATIONS = [
  "Obsmetrologia.Cohomology.CoverNerve.H0rank",
  "Obsmetrologia.Cohomology.CoverNerve.H1rank",
  "Obsmetrologia.Cohomology.CoverNerve.h1_vanishes_iff_forest",
  "Obsmetrologia.Cohomology.CoverNerve.h1rank_is_coordination_cost",
  "Obsmetrologia.Landauer.landauerBits",
  "Obsmetrologia.Landauer.landauer_zero_iff_reversible",
  "Obsmetrologia.Landauer.landauer_eq_coordination_cost",
];

class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function rpcError(code, message, data) {
  return new RpcError(code, message, data);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function attestMathematicalSources() {
  const observed = SOURCES.map((source) => {
    const digest = sha256(readFileSync(source.url));
    return {
      file: source.declarationFile,
      expectedSha256: source.sha256,
      observedSha256: digest,
      matches: digest === source.sha256,
    };
  });
  const drift = observed.filter((record) => !record.matches);
  if (drift.length) {
    throw rpcError(-32010, "admitted Obsmetrologia source bytes have drifted; conformance evidence is stale", { sources: observed });
  }
  return {
    library: "@emsenn/obsmetrologia",
    sources: observed,
    declarations: DECLARATIONS,
    assurance: {
      kind: "source-pinned-executable-projection",
      conformance: "Lean examples and JavaScript regression vectors exercise the same admitted cases",
      limitation: "the JavaScript is separately implemented and is not a formally verified extraction from Lean",
    },
  };
}

function isNat(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function computeCoverNerve({ entities, cells, components }) {
  if (![entities, cells, components].every(isNat)) {
    throw rpcError(-32602, "entities, cells, components must be non-negative safe integers");
  }
  if (components > entities) {
    throw rpcError(-32602, "not an admissible CoverNerve: components must be no greater than entities");
  }
  if (entities > cells + components) {
    throw rpcError(-32602, "not an admissible CoverNerve: entities must be no greater than cells plus components");
  }
  const h0rank = components;
  const h1rank = cells + components - entities;
  return {
    h0rank,
    h1rank,
    coordinationFree: h1rank === 0,
    landauerBits: h1rank,
    coordinationCost: h1rank,
  };
}

const METHODS = {
  "obsmetrologia.coverNerve.rank"(params) {
    if (typeof params !== "object" || params === null || Array.isArray(params)) {
      throw rpcError(-32602, "params must be an object with entities, cells, and components");
    }
    return { ...computeCoverNerve(params), certificate: attestMathematicalSources() };
  },
  "rpc.discover"() {
    return {
      service: "mathematical-readout-exchange",
      methods: Object.keys(METHODS),
      certificate: attestMathematicalSources(),
      costing: {
        policy: "measured local resource use; not a settled price",
        denomination: "mathematical-readout-exchange-cpu-seconds",
      },
    };
  },
};

function measuredCall(fn, params) {
  const wallStart = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();
  const result = fn(params);
  const cpu = process.cpuUsage(cpuStart);
  return {
    ...result,
    cost: {
      "fuel-consumed": (cpu.user + cpu.system) / 1e6,
      "wall-time-seconds": Number(process.hrtime.bigint() - wallStart) / 1e9,
      denomination: "mathematical-readout-exchange-cpu-seconds",
      settled: false,
    },
  };
}

export function handleRpc(request) {
  if (typeof request !== "object" || request === null || Array.isArray(request) || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return { jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32600, message: "Invalid Request" } };
  }
  const { method, params, id } = request;
  const operation = METHODS[method];
  if (!operation) {
    return { jsonrpc: "2.0", id: id ?? null, error: { code: -32601, message: `Method not found: ${method}` } };
  }
  try {
    const result = measuredCall(operation, params);
    if (id === undefined) return null;
    return { jsonrpc: "2.0", id, result };
  } catch (error) {
    if (id === undefined) return null;
    const code = error instanceof RpcError ? error.code : -32603;
    const response = { jsonrpc: "2.0", id, error: { code, message: error.message } };
    if (error instanceof RpcError && error.data !== undefined) response.error.data = error.data;
    return response;
  }
}

function respond(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createRpcServer() {
  return createServer((req, res) => {
    if (req.method !== "POST") {
      respond(res, 405, { error: "POST only" });
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        respond(res, 200, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        return;
      }
      if (Array.isArray(parsed) && parsed.length === 0) {
        respond(res, 200, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } });
        return;
      }
      const batch = Array.isArray(parsed) ? parsed : [parsed];
      const responses = batch.map(handleRpc).filter((response) => response !== null);
      respond(res, 200, Array.isArray(parsed) ? responses : responses[0] ?? {});
    });
  });
}

export function startRpcServer({ port = Number(process.env.PORT ?? 8737) } = {}) {
  attestMathematicalSources();
  const server = createRpcServer();
  server.listen(port, () => {
    const address = server.address();
    process.stdout.write(`mathematical-readout-exchange rpc listening on :${address.port}\n`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) startRpcServer();
