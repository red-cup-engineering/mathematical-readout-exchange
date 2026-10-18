import assert from "node:assert/strict";
import test from "node:test";

import {
  comparePlanarContactStates,
  runSiloxaneZeoliteRigidity,
  validateSiloxaneZeoliteRigidityInput,
} from "../src/siloxane-zeolite-rigidity.mjs";

// October 1 Materials source: same V=5, E=7, C=1, H1=3 but planar
// generic ranks 7 and 6. Source note `Associative Exchange and the Ring–Chain
// Ledger` §1: this is a graph counterexample, NOT proof a chemical
// associative reaction produces the stated graph change.
const A = [[0,1],[0,2],[1,2],[0,3],[1,3],[1,4],[2,4]];
const B = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3],[3,4]];

test("same-index rewiring is not a rigidity-preservation theorem", () => {
  const comparison = comparePlanarContactStates(5, A, B);
  assert.equal(comparison.changeClass, "equal-count-rewire-candidate");
  assert.deepEqual(comparison.before, {
    vertices: 5, contacts: 7, connectedComponents: 1,
    eulerIndex: -2, cycleRank: 3,
    meanCoordination: { numerator: "14", denominator: "5" },
    generic2dRank: 7,
  });
  assert.equal(comparison.after.generic2dRank, 6);
  assert.equal(comparison.after.eulerIndex, -2);
  assert.deepEqual(comparison.differences, {
    contacts: 0, components: 0, cycleRank: 0, generic2dRank: -1,
  });
  assert.equal(comparison.conservation.eulerIndex, true);
  assert.equal(comparison.conservation.meanCoordination, true);
  assert.equal(comparison.conservation.generic2dRank, false);
  assert.match(comparison.caveat, /No chemical associative exchange/u);
});

test("ring shedding respects the finite H0/H1 index balance but not chemical interpretation", () => {
  const path = [[0,1],[1,2],[2,3]];
  const ringWithFreeVertex = [[0,1],[1,2],[0,2]];
  const state = comparePlanarContactStates(4, path, ringWithFreeVertex);
  assert.equal(state.changeClass, "equal-count-rewire-candidate");
  assert.deepEqual(state.differences, {
    contacts: 0, components: 1, cycleRank: 1, generic2dRank: 0,
  });
  assert.equal(state.conservation.eulerIndex, true);
  assert.equal(state.conservation.cycleRank, false);
  assert.deepEqual(state.contactEdits, {
    removed: [[2,3]], added: [[0,2]],
  });
});

test("cutting a bridge and cutting a ring have different conserved charges", () => {
  const path = [[0,1],[1,2],[2,3]];
  const bridgeCut = comparePlanarContactStates(4, path, [[0,1],[1,2]]);
  assert.equal(bridgeCut.changeClass, "contact-removal");
  assert.equal(bridgeCut.differences.components, 1);
  assert.equal(bridgeCut.differences.cycleRank, 0);

  const triangle = [[0,1],[1,2],[0,2]];
  const ringCut = comparePlanarContactStates(4, triangle, [[0,1],[1,2]]);
  assert.equal(ringCut.changeClass, "contact-removal");
  assert.equal(ringCut.differences.components, 0);
  assert.equal(ringCut.differences.cycleRank, -1);
  assert.equal(bridgeCut.conservation.contactCount, false);
  assert.equal(ringCut.conservation.eulerIndex, false);
});

test("the material readout's original grid producer consumes a before/after contact pair", () => {
  const request = {
    conductivityGrid: [[0,0,0,0,0]], sigmaMatrix: 1, thresholds: [0.5],
    beforeStructuralContacts: A, structuralContacts: B,
  };
  const input = validateSiloxaneZeoliteRigidityInput(request);
  assert.deepEqual(input.beforeStructuralContacts, A);
  const response = runSiloxaneZeoliteRigidity(request);
  assert.equal(response.contactStateComparison.before.generic2dRank, 7);
  assert.equal(response.contactStateComparison.after.generic2dRank, 6);
  assert.equal(response.sweep[0].generic2dRigidity.rank, 6);
  assert.deepEqual(response.input.beforeStructuralContacts, A);
  assert.deepEqual(response.input.structuralContacts, B);
  assert.equal(response.contactStateComparison.provenance, "unverified-supplied-structural-hypotheses");
});

test("unreported state, duplicate edges and nonexistent sites are not fabricated as chemistry", () => {
  const base = { conductivityGrid: [[0,0,0]], sigmaMatrix: 1, thresholds: [0.5] };
  for (const invalid of [
    { beforeStructuralContacts: [[0,1]] },
    { beforeStructuralContacts: [[0,3]], structuralContacts: [[0,1]] },
    { beforeStructuralContacts: [[0,0]], structuralContacts: [[0,1]] },
    { beforeStructuralContacts: [[0,1],[1,0]], structuralContacts: [[0,1]] },
    { beforeStructuralContacts: "synthetic", structuralContacts: [[0,1]] },
  ]) assert.throws(() => runSiloxaneZeoliteRigidity({...base, ...invalid}), /Contacts/);
  assert.throws(() => comparePlanarContactStates(3, [], [[0,3]]), /after/);
  assert.throws(() => comparePlanarContactStates(3, [[0,1],[1,0]], []), /before/);
});
