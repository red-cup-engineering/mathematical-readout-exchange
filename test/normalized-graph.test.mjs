import test from "node:test";
import assert from "node:assert/strict";
import { normalizedGraphSummary } from "../src/normalized-graph.mjs";

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
