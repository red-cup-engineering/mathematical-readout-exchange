import { randomUUID } from "node:crypto";
import { assertNormalizedGraphResult, verifyGraphHomologyCertificate } from "./normalized-graph.mjs";
import { userRmnMessage, extractRmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { a2aResultMetadata, a2aResultParts, sendRmnTask } from "@red-cup-engineering/a2a-rmn-task-client-service";
import { SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION } from "@red-cup-engineering/relation-model-notation-runtime/hierarchical-circuit";
import {
  decodeRelationalGraphResult,
  encodeRelationalGraphRequest,
} from "./relational-graph-protocol.mjs";
import {
  decodeSiloxaneZeoliteRigidityResult,
  encodeSiloxaneZeoliteRigidityRequest,
} from "./siloxane-zeolite-rigidity-protocol.mjs";

function requireAgentUrl(agentUrl) {
  if (typeof agentUrl !== "string" || !/^https?:\/\//u.test(agentUrl)) throw new Error("one absolute mathematical-readout Agent Card URL is required");
}

async function requestReadout({ agentUrl, request, filename, decode, verify, signal, send }) {
  requireAgentUrl(agentUrl);
  const exchange = await send({
    agentUrl,
    extensions: [SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION],
    requireSignature: true,
    message: userRmnMessage(request.bytes, filename, randomUUID()),
    ...(signal ? { signal } : {}),
  });
  if (a2aResultMetadata(exchange.result).disposition !== "completion") throw new Error("mathematical-readout-exchange refused");
  const part = extractRmnPart(a2aResultParts(exchange.result));
  const decoded = decode(part.bytes);
  if (verify) verify(decoded.value);
  return Object.freeze({
    ...decoded.value,
    request: request.id,
    result: part.ni,
    effects: a2aResultMetadata(exchange.result).resourceEffects ?? null,
  });
}

export async function requestRelationalGraphReadout({ agentUrl, graph, certificate = false, signal, send = sendRmnTask }) {
  // A caller can mutate graph during an asynchronous provider call; bind
  // validation to the exact graph submitted, not its later mutable object.
  if (typeof certificate !== "boolean") throw new TypeError("graph certificate selection must be boolean");
  const submitted = {
    vertices: [...graph.vertices],
    edges: graph.edges.map(edge => [...edge]),
  };
  const request = encodeRelationalGraphRequest({ ...submitted, certificate });
  return requestReadout({
    agentUrl,
    request,
    filename: certificate ? "relational-graph-certificate-request.rmn.cbor" : "relational-graph-request.rmn.cbor",
    decode: decodeRelationalGraphResult,
    // A signature and mathematically plausible numbers never replace the
    // buyer's original source-graph-bound forest audit.
    verify: result => certificate
      ? verifyGraphHomologyCertificate(result, submitted)
      : assertNormalizedGraphResult(result, submitted),
    signal,
    send,
  });
}

export async function requestSiloxaneZeoliteRigidityReadout({ agentUrl, simulation, signal, send = sendRmnTask }) {
  const request = encodeSiloxaneZeoliteRigidityRequest(simulation);
  return requestReadout({
    agentUrl,
    request,
    filename: "siloxane-zeolite-rigidity-surrogate2d-request.rmn.cbor",
    decode: decodeSiloxaneZeoliteRigidityResult,
    signal,
    send,
  });
}
