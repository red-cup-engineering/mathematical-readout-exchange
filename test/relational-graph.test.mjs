import assert from "node:assert/strict";
import test from "node:test";

import { componentCount, componentIndices, hodgeDecomposition, laplacianOf, relationGraphOfCells, relationGraphOfNormalizedEdges, safeCount, treeCount } from "../src/relational-graph.mjs";
import {
  decodeRelationalGraphResult,
  encodeRelationalGraphRequest,
  encodeRelationalGraphResult,
  executeRelationalGraphReadout,
} from "../src/relational-graph-protocol.mjs";
import { userRmnMessage } from "@red-cup-engineering/a2a-rmn-part-service";
import { executeA2aMessage } from "../scripts/execute-a2a-task.mjs";

test("relation graph identities are canonical RMN ni URIs", () => {
  const graph = relationGraphOfCells([
    { subject: { entity: "a" }, object: { entity: "b" } },
    { subject: { entity: "b" }, object: { entity: "c" } },
    { subject: { entity: "c" }, object: { entity: "a" } },
  ]);
  assert.equal(graph.terms.every((term) => /^ni:\/\/\/sha-256;/.test(term)), true);
  assert.equal(componentCount(graph), 1);
  assert.equal(safeCount(treeCount(graph)), 3);
  assert.deepEqual(hodgeDecomposition(graph), { edges: 3, exact: 2, harmonic: 1 });
  assert.deepEqual(laplacianOf(graph), [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]]);
});

test("disconnected and repeated relations retain exact finite metrology", () => {
  const graph = relationGraphOfCells([
    { subject: "a", object: "b" },
    { subject: "a", object: "b" },
    { subject: "c", object: "c" },
  ]);
  assert.equal(componentCount(graph), 2);
  assert.deepEqual(componentIndices(graph), [[0, 1], [2]]);
  assert.equal(treeCount(graph), 0n);
  assert.deepEqual(hodgeDecomposition(graph), { edges: 2, exact: 1, harmonic: 1 });
});

test("normalized vertices and edges retain isolates and derive CoverNerve ranks", () => {
  const graph = relationGraphOfNormalizedEdges(
    ["a", "b", "c", "d"],
    [["a", "b"], ["a", "c"], ["b", "c"]],
  );
  assert.equal(componentCount(graph), 2);
  assert.deepEqual(componentIndices(graph), [[0, 1, 2], [3]]);
  const request = encodeRelationalGraphRequest({
    vertices: ["a", "b", "c", "d"],
    edges: [["a", "b"], ["a", "c"], ["b", "c"]],
  });
  const first = executeRelationalGraphReadout(request.bytes);
  const replay = executeRelationalGraphReadout(request.bytes);
  assert.equal(first.id, replay.id);
  assert.deepEqual(decodeRelationalGraphResult(first.bytes).value, {
    kind: "NormalizedRelationalGraphReadoutResult.v1",
    entities: 4,
    cells: 3,
    components: 2,
    h0rank: 2,
    h1rank: 1,
    coordinationFree: false,
    landauerBits: 1,
    coordinationCost: 1,
    exactRank: 2,
    harmonicRank: 1,
    componentPartition: [["a", "b", "c"], ["d"]],
  });
});

test("result decoder refuses a missing or non-canonical component partition", () => {
  for (const componentPartition of [undefined, [["b", "a"]], [["a"], ["a"]]]) {
    const result = encodeRelationalGraphResult({
      entities: 2, cells: 1, components: 1, h0rank: 1, h1rank: 0,
      coordinationFree: true, landauerBits: 0, coordinationCost: 0,
      exactRank: 1, harmonicRank: 0,
      ...(componentPartition === undefined ? {} : { componentPartition }),
    });
    assert.throws(() => decodeRelationalGraphResult(result.bytes), /canonical component partition/u);
  }
});

test("A2A executor serves normalized graph readout and refuses non-normalized input", async () => {
  const request = encodeRelationalGraphRequest({ vertices: ["a", "b", "c"], edges: [["a", "b"], ["b", "c"]] });
  const response = await executeA2aMessage(userRmnMessage(request.bytes, "relational-graph-request.rmn.cbor"));
  assert.equal(response.metadata.disposition, "completion");
  const result = decodeRelationalGraphResult(Buffer.from(response.parts[0].raw, "base64")).value;
  assert.equal(result.components, 1);
  assert.equal(result.h1rank, 0);

  const malformed = encodeRelationalGraphRequest({ vertices: ["b", "a"], edges: [["a", "b"]] });
  await assert.rejects(
    () => executeA2aMessage(userRmnMessage(malformed.bytes, "relational-graph-request.rmn.cbor")),
    /vertices must be unique and sorted/u,
  );

  for (const [graph, reason] of [
    [{ vertices: ["a"], edges: [["a", "a"]] }, /endpoints must be distinct/u],
    [{ vertices: ["a", "b"], edges: [["a", "c"]] }, /unknown vertex/u],
    [{ vertices: ["a", "b"], edges: [["a", "b"], ["a", "b"]] }, /edges must be unique/u],
  ]) {
    const refused = encodeRelationalGraphRequest(graph);
    await assert.rejects(
      () => executeA2aMessage(userRmnMessage(refused.bytes, "relational-graph-request.rmn.cbor")),
      reason,
    );
  }
});
