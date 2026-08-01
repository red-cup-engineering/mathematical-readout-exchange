import {
  decodeRelationalValue,
  encodeRelationalValue,
} from "@red-cup-engineering/rmn-semantic-conformance-die/relational-value";
import {
  decodeSemantic,
  semanticBytes,
  semanticId,
} from "@red-cup-engineering/rmn-semantic-conformance-die";
import { computeCoverNerve } from "@lenticule-science/cover-nerve-rank-readout-service/function";
import {
  componentIndices,
  hodgeDecomposition,
  relationGraphOfNormalizedEdges,
} from "./relational-graph.mjs";

export const RELATIONAL_GRAPH_READOUT = Object.freeze({
  input: "NormalizedRelationalGraphReadoutRequest.v1",
  output: "NormalizedRelationalGraphReadoutResult.v1",
});

function ascribedValue(value) {
  const encoded = encodeRelationalValue(value);
  const term = ["ascribe", encoded.type, encoded.term];
  return { bytes: semanticBytes(term), id: semanticId(term), term };
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
  return ascribedValue({ kind: RELATIONAL_GRAPH_READOUT.input, vertices, edges });
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
    relationGraphOfNormalizedEdges(value.vertices, value.edges);
  } catch (cause) {
    const error = new Error(cause.message, { cause });
    error.code = "invalid-relational-graph";
    throw error;
  }
  return { ...decoded, value };
}

export function encodeRelationalGraphResult(readout) {
  return ascribedValue({ kind: RELATIONAL_GRAPH_READOUT.output, ...readout });
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
  const graph = relationGraphOfNormalizedEdges(input.value.vertices, input.value.edges);
  const componentPartition = componentIndices(graph)
    .map((component) => component.map((index) => input.value.vertices[index]));
  const hodge = hodgeDecomposition(graph, componentPartition.length);
  const nerve = {
    entities: input.value.vertices.length,
    cells: input.value.edges.length,
    components: componentPartition.length,
  };
  const result = encodeRelationalGraphResult({
    ...nerve,
    ...computeCoverNerve(nerve),
    exactRank: hodge.exact,
    harmonicRank: hodge.harmonic,
    componentPartition,
  });
  return { inputId: semanticId(input.term), ...result };
}
