import {
  decodeRelationalValue,
  encodeRelationalValue,
} from "@red-cup-engineering/relation-model-notation-runtime/relational-value";
import {
  decodeSemantic,
  semanticBytes,
} from "@red-cup-engineering/relation-model-notation-runtime";
import { computeCoverNerve } from "@lenticule-science/cover-nerve-rank-readout-service/function";
import { normalizedGraphSummary } from "./normalized-graph.mjs";
import { jsonId } from "./semantic-identity.mjs";

export const RELATIONAL_GRAPH_READOUT = Object.freeze({
  input: "NormalizedRelationalGraphReadoutRequest.v1",
  output: "NormalizedRelationalGraphReadoutResult.v1",
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

export function encodeRelationalGraphRequest({ vertices, edges }) {
  return ascribedValue({ kind: RELATIONAL_GRAPH_READOUT.input, vertices, edges }, "lenticule.mathematical-readout.relational-graph-request");
}

export function decodeRelationalGraphRequest(bytes) {
  const decoded = decodeAscribedValue(bytes);
  const value = decoded.value;
  if (
    value?.kind !== RELATIONAL_GRAPH_READOUT.input
    || Object.keys(value).sort().join(",") !== "edges,kind,vertices"
  ) {
    const error = new Error(`relational-graph readout requires exactly one ${RELATIONAL_GRAPH_READOUT.input}`);
    error.code = "wrong-die-input";
    throw error;
  }
  try {
    return { ...decoded, value, summary: normalizedGraphSummary(value.vertices, value.edges) };
  } catch (cause) {
    const error = new Error(cause.message, { cause });
    error.code = "invalid-relational-graph";
    throw error;
  }
}

export function encodeRelationalGraphResult(readout) {
  return ascribedValue({ kind: RELATIONAL_GRAPH_READOUT.output, ...readout }, "lenticule.mathematical-readout.relational-graph-result");
}

export function decodeRelationalGraphResult(bytes) {
  const decoded = decodeAscribedValue(bytes);
  const value = decoded.value;
  if (value?.kind !== RELATIONAL_GRAPH_READOUT.output) {
    const error = new Error(`relational-graph output is not ${RELATIONAL_GRAPH_READOUT.output}`);
    error.code = "wrong-die-output";
    throw error;
  }
  const partition = value.componentPartition;
  const canonicalPartition = Array.isArray(partition)
    && partition.length === value.components
    && partition.every((component) => Array.isArray(component) && component.length > 0
      && component.every((vertex, index) => typeof vertex === "string" && vertex.length > 0
        && (index === 0 || component[index - 1] < vertex)))
    && partition.every((component, index) => index === 0 || partition[index - 1][0] < component[0]);
  const flattened = canonicalPartition ? partition.flat() : [];
  if (!canonicalPartition || flattened.length !== value.entities || new Set(flattened).size !== flattened.length) {
    const error = new Error("relational-graph output omits its canonical component partition");
    error.code = "wrong-die-output";
    throw error;
  }
  return decoded;
}

export function executeRelationalGraphReadout(inputBytes) {
  const input = decodeRelationalGraphRequest(inputBytes);
  // The validated summary is exact for the normalized simple-graph profile.
  // Weighted/Laplacian APIs remain separate for requests requiring matrices.
  const { summary } = input;
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
