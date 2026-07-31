import {
  AgentCard,
  Message,
  Role,
  canonicalizeAgentCard,
} from "@a2a-js/sdk";
import agentCardTemplate from "../content/agent-cards/mathematical-readout-exchange.json";
import jwks from "../content/agent-card-signing/jwks.json";
import {
  executeRelationalGraphReadout,
  mathematicalReadoutRequestKind,
  RELATIONAL_GRAPH_READOUT,
} from "../src/relational-graph-protocol.mjs";

const SOURCE_CERTIFICATE = Object.freeze({
  kind: "release-source-pin",
  library: "@lenticule-science/obsmetrologia",
  sources: [
    {
      file: "Obsmetrologia/Cohomology/CoordinationCohomology.lean",
      sha256: "6494b3f82306922978345eb22d3fab58bbc8240c3dbb62c9e2a5fc915ccd9e06",
    },
    {
      file: "Obsmetrologia/Cohomology/LandauerEntropy.lean",
      sha256: "c681484d6f77d21c49f30f211832245dcf80184067faf8e69e946a707d933801",
    },
  ],
  assurance: {
    theoremStatus: "the cited Lean declarations are proved in the pinned Obsmetrologia source",
    projectionStatus: "this JavaScript carrier is separately implemented and regression-assayed; it is not a formally verified extraction",
    observationStatus: "source-byte equality is checked when the release carrier is cut, not re-read from an ambient filesystem by this node",
  },
});

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

function base64url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function bytesFromBase64(source) {
  const binary = atob(source);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function pemBytes(source) {
  return bytesFromBase64(source.replace(/-----[^-]+-----/gu, "").replace(/\s+/gu, ""));
}

async function signedAgentCard(request, env) {
  const origin = new URL(request.url).origin;
  const card = structuredClone(agentCardTemplate);
  card.version = "2.0.0";
  card.description = "Cloud-mounted A2A 1.0 face for normalized relational-graph metrology; pre-release until exact attributable replay evidence and market induction are available.";
  card.supportedInterfaces = [
    { url: `${origin}/a2a/jsonrpc`, protocolBinding: "JSONRPC", tenant: "", protocolVersion: "1.0" },
    { url: `${origin}/a2a/rest`, protocolBinding: "HTTP+JSON", tenant: "", protocolVersion: "1.0" },
  ];
  card.skills[0].description = "Accepts exactly one canonical normalized relational-graph RMN value and returns its deterministic metrology result plus separately qualified release and resource metadata.";
  card.signatures = [];
  const normalized = AgentCard.toJSON(AgentCard.fromJSON(card));
  delete normalized.signatures;
  const payload = base64url(new TextEncoder().encode(canonicalizeAgentCard(normalized)));
  const protectedHeader = base64url(new TextEncoder().encode(JSON.stringify({
    alg: "EdDSA",
    kid: jwks.keys[0].kid,
    typ: "JOSE",
    jku: `${origin}/.well-known/jwks.json`,
  })));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(env.AGENT_CARD_PRIVATE_KEY),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(`${protectedHeader}.${payload}`),
  );
  card.signatures = [{ protected: protectedHeader, signature: base64url(signature) }];
  return card;
}

function rmnPart(message) {
  const parts = message.parts ?? [];
  const matches = parts.filter((part) => part?.mediaType === "application/rmn+cbor" && typeof part.raw === "string");
  if (matches.length !== 1) throw new Error("request must carry exactly one application/rmn+cbor raw part");
  return matches[0];
}

function executeMessage(source) {
  const message = Message.fromJSON(source);
  if (message.role !== Role.ROLE_USER) throw new Error("mathematical relational-graph service requires an A2A ROLE_USER message");
  const input = rmnPart(Message.toJSON(message));
  const inputBytes = bytesFromBase64(input.raw);
  const requestKind = mathematicalReadoutRequestKind(inputBytes);
  const started = performance.now();
  let result;
  let filename;
  if (requestKind === RELATIONAL_GRAPH_READOUT.input) {
    result = executeRelationalGraphReadout(inputBytes);
    filename = "relational-graph-result.rmn.cbor";
  } else {
    throw new Error(`unsupported mathematical-readout kind ${requestKind ?? "[absent]"}`);
  }
  const elapsed = Math.max(0, performance.now() - started);
  return {
    messageId: crypto.randomUUID(),
    contextId: message.contextId,
    taskId: message.taskId,
    role: "ROLE_AGENT",
    parts: [{
      raw: Buffer.from(result.bytes).toString("base64"),
      metadata: { ni: result.id },
      filename,
      mediaType: "application/rmn+cbor",
    }],
    metadata: {
      disposition: "completion",
      requestNi: input.metadata?.ni ?? result.inputId,
      responseNi: result.id,
      mathematicalSourceCertificate: SOURCE_CERTIFICATE,
      resourceEffects: {
        dimension: "time",
        quantity: String(elapsed),
        unit: "cloudflare-worker-milliseconds",
        settled: false,
      },
      carrier: {
        class: "cloudflare-worker",
        placement: "ephemeral-isolate",
        ambientFilesystem: false,
        ambientModel: false,
      },
    },
    extensions: [],
    referenceTaskIds: [],
  };
}

async function invoke(request) {
  const body = await request.json();
  if (new URL(request.url).pathname.endsWith("/jsonrpc")) {
    if (body?.jsonrpc !== "2.0" || body?.method !== "message/send" || !body?.params?.message) {
      return json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32600, message: "only message/send is implemented" } }, { status: 400 });
    }
    try {
      return json({ jsonrpc: "2.0", id: body.id, result: executeMessage(body.params.message) });
    } catch (error) {
      return json({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: error.message, data: { disposition: "refused", code: error.code ?? "relational-graph-refusal" } } }, { status: 400 });
    }
  }
  if (!body?.message) return json({ error: { code: "invalid-a2a-request", message: "message is required" } }, { status: 400 });
  try {
    return json({ message: executeMessage(body.message) });
  } catch (error) {
    return json({ error: { code: error.code ?? "relational-graph-refusal", message: error.message, disposition: "refused" } }, { status: 400 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
      return json(await signedAgentCard(request, env), { headers: { "cache-control": "public, max-age=60" } });
    }
    if (request.method === "GET" && url.pathname === "/.well-known/jwks.json") {
      return json(jwks, { headers: { "content-type": "application/jwk-set+json", "cache-control": "public, max-age=3600" } });
    }
    if (request.method === "POST" && (url.pathname === "/a2a/rest/message:send" || url.pathname === "/a2a/jsonrpc")) {
      return invoke(request);
    }
    return json({ error: { code: "not-found", message: "use A2A discovery" } }, { status: 404 });
  },
};
