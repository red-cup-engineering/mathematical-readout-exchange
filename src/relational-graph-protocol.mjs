import {
  decodeRelationalValue,
  encodeRelationalValue,
} from "@red-cup-engineering/relation-model-notation-runtime/relational-value";
import {
  decodeSemantic,
  semanticBytes,
} from "@red-cup-engineering/relation-model-notation-runtime";
import { computeCoverNerve } from "@lenticule-science/cover-nerve-rank-readout-service/function";
import { normalizedGraphSummary, assertNormalizedGraphResult, certifiedGraphHomology } from "./normalized-graph.mjs";
import { jsonId } from "./semantic-identity.mjs";

export const RELATIONAL_GRAPH_READOUT = Object.freeze({
  input: "NormalizedRelationalGraphReadoutRequest.v1",
  output: "NormalizedRelationalGraphReadoutResult.v1",
});
// A separate opt-in mathematical result type; existing V1 bytes stay stable.
export const RELATIONAL_GRAPH_CERTIFICATE = Object.freeze({
  input: "NormalizedGraphHomologyCertificateRequest.v1",
  output: "NormalizedGraphHomologyCertificate.v1",
});

function ascribedValue(value, objectKind) {
  const encoded = encodeRelationalValue(value);
  const term = ["ascribe", encoded.type, encoded.term];
  return { bytes: semanticBytes(term), id: jsonId(term, objectKind), term };
}

export function decodeAscribedValue(bytes) {
  const source = Buffer.from(bytes);
  const term = decodeSemantic(source);
  if (!semanticBytes(term).equals(source)) {
    const error = new Error("mathematical readout input is not RFC 8949 deterministic CBOR");
    error.code = "non-canonical-rmn";
    throw error;
  }
  if (term?.[0] !== "ascribe" || term.length !== 3) {
    const error = new Error("mathematical readout input is not one typed RMN value");
    error.code = "wrong-die-input";
    throw error;
  }
  return { term, value: decodeRelationalValue(term[1], term[2]) };
}

export function mathematicalReadoutRequestKind(bytes) {
  return decodeAscribedValue(bytes).value?.kind ?? null;
}

export function encodeRelationalGraphRequest({ vertices, edges, certificate = false }) {
  if (typeof certificate !== "boolean") throw new TypeError("graph certificate selection must be boolean");
  return ascribedValue({ kind: certificate ? RELATIONAL_GRAPH_CERTIFICATE.input : RELATIONAL_GRAPH_READOUT.input, vertices, edges }, "lenticule.mathematical-readout.relational-graph-request");
}

export function decodeRelationalGraphRequest(bytes) {
  const decoded = decodeAscribedValue(bytes);
  const value = decoded.value;
  if (
    ![RELATIONAL_GRAPH_READOUT.input,RELATIONAL_GRAPH_CERTIFICATE.input].includes(value?.kind)
    || Object.keys(value).sort().join(",") !== "edges,kind,vertices"
  ) {
    const error = new Error(`relational-graph readout requires exactly one ${RELATIONAL_GRAPH_READOUT.input}`);
    error.code = "wrong-die-input";
    throw error;
  }
  try {
    const certificate=value.kind===RELATIONAL_GRAPH_CERTIFICATE.input;
    return { ...decoded, value, summary: certificate
      ? certifiedGraphHomology(value.vertices, value.edges)
      : normalizedGraphSummary(value.vertices, value.edges) };
  } catch (cause) {
    const error = new Error(cause.message, { cause });
    error.code = "invalid-relational-graph";
    throw error;
  }
}

export function encodeRelationalGraphResult(readout) {
  const kind=readout?.kind??RELATIONAL_GRAPH_READOUT.output;
  if (![RELATIONAL_GRAPH_READOUT.output,RELATIONAL_GRAPH_CERTIFICATE.output].includes(kind))
    throw new TypeError("unknown mathematical readout result kind");
  return ascribedValue({ ...readout, kind }, "lenticule.mathematical-readout.relational-graph-result");
}

export function decodeRelationalGraphResult(bytes) {
  const decoded = decodeAscribedValue(bytes);
  const value = decoded.value;
  if (![RELATIONAL_GRAPH_READOUT.output,RELATIONAL_GRAPH_CERTIFICATE.output].includes(value?.kind)) {
    const error = new Error("unsupported mathematical relational-graph result kind");
    error.code = "wrong-die-output";
    throw error;
  }
  assertNormalizedGraphResult(value);
  // The source-graph-bound witness is checked by the independent *buyer* after
  // result decoding. An internally well-shaped signed output is not a proof.
  if (value.kind === RELATIONAL_GRAPH_CERTIFICATE.output && !Array.isArray(value.forestEdges))
    throw new TypeError("source-checkable graph certificate requires its forest");
  return decoded;
}

export function executeRelationalGraphReadout(inputBytes) {
  const input = decodeRelationalGraphRequest(inputBytes);
  // The validated summary is exact for the normalized simple-graph profile.
  // Weighted/Laplacian APIs remain separate for requests requiring matrices.
  const { summary } = input;
  if(input.value.kind===RELATIONAL_GRAPH_CERTIFICATE.input){
    const result=encodeRelationalGraphResult(summary);
    return { inputId: jsonId(input.term, "lenticule.mathematical-readout.relational-graph-request"), ...result };
  }
  const nerve = {
    entities: summary.entities,
    cells: summary.cells,
    components: summary.components,
  };
  const result = encodeRelationalGraphResult({
    ...nerve,
    ...computeCoverNerve(nerve),
    exactRank: summary.exactRank,
    harmonicRank: summary.harmonicRank,
    componentPartition: summary.componentPartition,
  });
  return { inputId: jsonId(input.term, "lenticule.mathematical-readout.relational-graph-request"), ...result };
}
