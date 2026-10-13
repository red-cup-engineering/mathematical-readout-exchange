import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generic2dRigidityRank, runSiloxaneZeoliteRigidity,
  validateSiloxaneZeoliteRigidityInput,
} from "../src/siloxane-zeolite-rigidity.mjs";

// Brute-force (2,3)-sparsity definition, independent of the pebble algorithm.
function independent(n, edges) {
  for (let mask = 1; mask < (1 << n); mask++) {
    let vertices = 0;
    for (let i=0;i<n;i++) if (mask & (1 << i)) vertices++;
    if (vertices < 2) continue;
    const local = edges.filter(([a,b]) => (mask & (1 << a)) && (mask & (1 << b))).length;
    if (local > 2 * vertices - 3) return false;
  }
  return true;
}

test("the oriented pebble game agrees with independently enumerated Laman sparsity up to five vertices", () => {
  let cases = 0;
  for (let n=2;n<=5;n++) {
    const all = [];
    for (let i=0;i<n;i++) for(let j=i+1;j<n;j++) all.push([i,j]);
    for (let selection=0;selection<(1<<all.length);selection++) {
      const edges = all.filter((_,i) => selection & (1<<i));
      const game = generic2dRigidityRank(n,edges);
      const chosen=[];
      const rejected=[];
      edges.forEach((edge,index) => {
        if (independent(n,[...chosen.map(i=>edges[i]),edge])) chosen.push(index);
        else rejected.push(index);
      });
      assert.deepEqual(game.accepted,chosen,`n=${n}, subset=${selection}`);
      assert.deepEqual(game.rejected,rejected,`n=${n}, subset=${selection}`);
      assert.equal(game.rank,chosen.length);
      cases++;
    }
  }
  assert.ok(cases > 1000);
});

test("contact graph indices and public model dimensions refuse invalid numerical work", () => {
  for (const bad of [[0,[]],[-1,[]],[1.5,[]],[65537,[]],[3,[[0,3]]],
    [3,[[0,-1]]],[3,[[1,1]]],[3,[[1,2,0]]],[3,[{}]], [3,"string"], [3,[[NaN,2]]]]) {
    assert.throws(()=>generic2dRigidityRank(...bad), /(edges|vertices|contact)/);
  }
  assert.throws(() => generic2dRigidityRank(2,Array(262145).fill([0,1])),/262144/);
  assert.throws(() => validateSiloxaneZeoliteRigidityInput({
    conductivityGrid: Array.from({length:129},()=>Array(129).fill(.5)),
    sigmaMatrix:1, thresholds:[.5],
  }), /16384/);
  assert.throws(() => validateSiloxaneZeoliteRigidityInput({
    conductivityGrid: [[.5]], sigmaMatrix:1, thresholds:Array(262145).fill(.5),
  }), /bounded assay/);
});

test("the finite conductivity surrogate avoids overflow at extreme representable scales", () => {
  const out = runSiloxaneZeoliteRigidity({
    conductivityGrid: [[Number.MAX_VALUE, Number.MIN_VALUE]],
    sigmaMatrix: Number.MIN_VALUE, thresholds: [0.25],
  });
  assert.deepEqual(out.phiGrid, [[0, 0]]);
  assert.equal(out.sweep[0].contactGraph.components,0);
});

test("accepted and rejected contact order stays canonical for the existing K4 consumer", () => {
  const edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  const out = generic2dRigidityRank(4,edges);
  assert.deepEqual(out,{rank:5,accepted:[0,1,2,3,4],rejected:[5]});
});
