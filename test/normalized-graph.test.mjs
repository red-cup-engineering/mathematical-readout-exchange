import test from "node:test";
import assert from "node:assert/strict";
import { normalizedGraphSummary, assertNormalizedGraphResult } from "../src/normalized-graph.mjs";

test("component, incidence and cycle ranks agree on a graph with an isolate",()=>{
  const vertices=["a","b","c","d"];
  const path=normalizedGraphSummary(vertices,[["a","b"],["b","c"]]);
  assert.deepEqual(path,{
    entities:4,cells:2,components:2,exactRank:2,harmonicRank:0,
    componentPartition:[["a","b","c"],["d"]]
  });
  const triangle=normalizedGraphSummary(vertices,[["a","b"],["a","c"],["b","c"]]);
  assert.deepEqual(triangle,{
    entities:4,cells:3,components:2,exactRank:2,harmonicRank:1,
    componentPartition:[["a","b","c"],["d"]]
  });
});

test("a large finite graph is handled without a dense V by V matrix",()=>{
  const vertices=Array.from({length:8000},(_,i)=>"v"+String(i).padStart(5,"0"));
  const edges=vertices.slice(1).map((vertex,i)=>[vertices[i],vertex]);
  const result=normalizedGraphSummary(vertices,edges);
  assert.equal(result.components,1);
  assert.equal(result.exactRank,7999);
  assert.equal(result.harmonicRank,0);
  assert.equal(result.componentPartition[0].length,8000);
});

test("strict normalized-graph admission refuses duplicate, reversed, or unknown edges",()=>{
  const vertices=["a","b","c"];
  for(const [edges,reason] of [
    [[["a","a"]],/endpoints must be distinct/],
    [[["b","a"]],/endpoints must be distinct and sorted/],
    [[["a","z"]],/unknown vertex/],
    [[["a","b"],["a","b"]],/unique and sorted/],
    [[["b","c"],["a","b"]],/unique and sorted/]
  ])assert.throws(()=>normalizedGraphSummary(vertices,edges),reason);
  assert.throws(()=>normalizedGraphSummary(["b","a"],[]),/vertices must be unique and sorted/);
  assert.throws(()=>normalizedGraphSummary([],[]),/at least one vertex/);
});

test("disconnected vertices retain separate components and zero cycle rank",()=>{
  const result=normalizedGraphSummary(["a","b","c"],[]);
  assert.equal(result.components,3);
  assert.deepEqual(result.componentPartition,[["a"],["b"],["c"]]);
  assert.equal(result.harmonicRank,0);
});


test("remote mathematical readout must satisfy graph Euler/homology identities", () => {
  const summary = normalizedGraphSummary(["a","b","c","d"],[["a","b"],["b","c"]]);
  const valid = { ...summary, h0rank: summary.components, h1rank: summary.harmonicRank };
  assert.equal(assertNormalizedGraphResult(valid), valid);
  assert.equal(assertNormalizedGraphResult(valid, {
    vertices:["a","b","c","d"],edges:[["a","b"],["b","c"]],
  }), valid);
  // This is internally consistent but partitions the supplied graph wrongly.
  const plausibleForgery = { ...valid, componentPartition:[["a"],["b","c","d"]] };
  assert.equal(assertNormalizedGraphResult(plausibleForgery),plausibleForgery);
  assert.throws(()=>assertNormalizedGraphResult(plausibleForgery,{
    vertices:["a","b","c","d"],edges:[["a","b"],["b","c"]],
  }), /disagrees with the submitted graph/);
  for (const altered of [
    { h0rank: 7 }, { h1rank: 1 }, { exactRank: 3 }, { harmonicRank: -1 },
    { entities: 5 }, { cells: 8 }, { components: 3 }, { exactRank: 1.25 },
    { h0rank: "2" }, { componentPartition: [["a"],["b","c","d"]] },
    { componentPartition: [["a","c","b"],["d"]] },
    { componentPartition: [["a","b","c"],["c"]] },
  ]) {
    assert.throws(() => assertNormalizedGraphResult({ ...valid, ...altered }),
      /(homology ranks|integer ranks|canonical component partition)/);
  }
});

test("a canonical-looking partition cannot conceal repeated or missing graph entities", () => {
  const result = {
    entities: 3, cells: 1, components: 2, h0rank: 2, h1rank: 0,
    exactRank: 1, harmonicRank: 0, componentPartition: [["a","b"],["c"]],
  };
  assert.equal(assertNormalizedGraphResult(result),result);
  assert.throws(() => assertNormalizedGraphResult({...result,componentPartition:[["a","b"],["b"]]}), /canonical/);
  assert.throws(() => assertNormalizedGraphResult({...result,componentPartition:[["a"],["c"]]}), /canonical/);
});
