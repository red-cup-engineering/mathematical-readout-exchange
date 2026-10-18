import assert from "node:assert/strict";
import test from "node:test";

import {
  generic2dRigidityRank,
  runSiloxaneZeoliteRigidity,
  validateSiloxaneZeoliteRigidityInput,
} from "../src/siloxane-zeolite-rigidity.mjs";

// Exact A/B graphs from the 2026-10-01 associative-exchange/ring-chain
// ledger, section 1.  Equal |V|, |E|, chi, H1 and coordination DO NOT
// establish rigidity equivalence. These are hypothetical *planar contact*
// graphs, not observed siloxane/zeolite bonds or physical modulus readings.
const A = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4]];
const B = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [3, 4]];
const common = { conductivityGrid: [[0, 0, 0, 0, 0]], sigmaMatrix: 1, thresholds: [0.5] };

test("the same-count vitrimer exchange graphs have different planar mechanical ranks", () => {
  const first = runSiloxaneZeoliteRigidity({ ...common, structuralContacts: A });
  const second = runSiloxaneZeoliteRigidity({ ...common, structuralContacts: B });
  const [a, b] = [first.sweep[0], second.sweep[0]];
  assert.deepEqual(first.phiGrid, second.phiGrid);
  assert.deepEqual([a.contactGraph.vertices, a.contactGraph.edges, a.contactGraph.components, a.contactGraph.cycleRank], [5, 7, 1, 3]);
  assert.deepEqual([b.contactGraph.vertices, b.contactGraph.edges, b.contactGraph.components, b.contactGraph.cycleRank], [5, 7, 1, 3]);
  assert.equal(a.generic2dRigidity.rank, 7);
  assert.equal(b.generic2dRigidity.rank, 6);
  assert.equal(a.generic2dRigidity.components[0].rigid, true);
  assert.equal(b.generic2dRigidity.components[0].rigid, false);
  assert.equal(a.contactGraph.provenance, "unverified-supplied-contacts");
  assert.equal(b.contactGraph.provenance, "unverified-supplied-contacts");
  assert.match(first.scope, /explicitly supplied planar structural contacts/u);
  assert.ok(first.limitations.some((limit) => limit.includes("retracted")));
  assert.deepEqual(generic2dRigidityRank(5, A).accepted, [0, 1, 2, 3, 4, 5, 6]);
});

test("real work is added by a caller-supplied non-grid contact, without changing legacy mode", () => {
  const specimen = { conductivityGrid: [[0, 0], [0, 0]], sigmaMatrix: 1, thresholds: [0.5] };
  const implicit = runSiloxaneZeoliteRigidity(specimen).sweep[0];
  const explicit = runSiloxaneZeoliteRigidity({
    ...specimen,
    structuralContacts: [[0, 1], [1, 3], [3, 2], [2, 0], [0, 3]],
  }).sweep[0];
  assert.equal(implicit.contactGraph.edges, 4);
  assert.equal(implicit.generic2dRigidity.rank, 4);
  assert.equal(implicit.generic2dRigidity.components[0].rigid, false);
  assert.equal(implicit.contactGraph.provenance, "inferred-four-neighbor-surrogate");
  assert.equal(explicit.contactGraph.edges, 5);
  assert.equal(explicit.generic2dRigidity.rank, 5);
  assert.equal(explicit.generic2dRigidity.components[0].rigid, true);
});

test("an inactive site cannot acquire fictional structural contacts from the input", () => {
  const assay = runSiloxaneZeoliteRigidity({
    conductivityGrid: [[0, 0, 0, 0, 1]], sigmaMatrix: 1, thresholds: [0.5],
    structuralContacts: A,
  }).sweep[0];
  assert.equal(assay.activeVertexCount, 4);
  assert.equal(assay.contactGraph.edges, 5);
  assert.equal(assay.generic2dRigidity.rank, 5);
});

test("explicit contacts refuse duplicate, out-of-domain and self-loop hypotheses", () => {
  const bad = [
    [[0, 1], [1, 0]], [[0, 0]], [[0, 5]], [[0, -1]],
    [[0, 1.5]], [[0, "1"]], [[0, NaN]], [[0, 1, 2]],
    [{}], "string", null,
  ];
  for (const structuralContacts of bad) {
    assert.throws(
      () => validateSiloxaneZeoliteRigidityInput({ ...common, structuralContacts }),
      /structuralContacts/,
    );
  }
  const empty = runSiloxaneZeoliteRigidity({ ...common, structuralContacts: [] }).sweep[0];
  assert.equal(empty.contactGraph.edges, 0);
  assert.equal(empty.contactGraph.components, 5);
});
