import assert from "node:assert/strict";
import test from "node:test";

import { componentCount, hodgeDecomposition, laplacianOf, relationGraphOfCells, safeCount, treeCount } from "../src/relational-graph.mjs";

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
  assert.equal(treeCount(graph), 0n);
  assert.deepEqual(hodgeDecomposition(graph), { edges: 2, exact: 1, harmonic: 1 });
});
