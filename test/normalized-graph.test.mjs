import test from "node:test";
import assert from "node:assert/strict";
import { normalizedGraphSummary, assertNormalizedGraphResult } from "../src/normalized-graph.mjs";
import * as graphCertificate from "../src/normalized-graph.mjs";


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
    { h0rank: "2" }, { componentPartition: [["a","b"],["c","d","e"]] },
    { componentPartition: [["a","c","b"],["d"]] },
    { componentPartition: [["a","b","c"],["c"]] },
  ]) {
    assert.throws(() => assertNormalizedGraphResult({ ...valid, ...altered }),
      /(homology ranks|integer ranks|canonical component partition)/);
  }
});


// Graph-homology certificate contract: mathematical witnesses rather than
// a provider's self-reported H0/H1 scalar. These are source-only finite tests;
// independent input/output/rights and external payment remain downstream.
test("an independently checkable spanning forest witnesses exact H0/H1 without a second graph service", () => {
  const vertices=["a","b","c","d"];
  const edges=[["a","b"],["a","c"],["b","c"]];
  const untouched=structuredClone({vertices,edges});
  const certificate=graphCertificate.certifiedGraphHomology(vertices,edges);
  assert.equal(certificate.kind,"NormalizedGraphHomologyCertificate.v1");
  assert.deepEqual(certificate.forestEdges,[["a","b"],["a","c"]]);
  assert.deepEqual(certificate.componentPartition,[["a","b","c"],["d"]]);
  assert.deepEqual([certificate.h0rank,certificate.h1rank],[2,1]);
  assert.equal(graphCertificate.verifyGraphHomologyCertificate(certificate,{vertices,edges}),certificate);
  assert.deepEqual({vertices,edges},untouched);
  assert.deepEqual(
    [certificate.entities,certificate.cells,certificate.components,certificate.exactRank,certificate.harmonicRank],
    Object.values(normalizedGraphSummary(vertices,edges)).slice(0,5)
  );
});

test("a falsely certified result is refused even when its Euler counts remain plausible", () => {
  const vertices=["a","b","c","d"];
  const edges=[["a","b"],["a","c"],["b","c"]];
  const cert=graphCertificate.certifiedGraphHomology(vertices,edges);
  const mutated=changes=>({...cert,...changes});
  const bad=[
    mutated({forestEdges:[["a","b"]]}), // no complete spanning forest
    mutated({forestEdges:[["a","b"],["b","c"],["a","c"]]}), // cycle
    mutated({forestEdges:[["a","b"],["c","d"]]}), // fabricated input edge
    mutated({forestEdges:[["b","a"],["a","c"]]}), // noncanonical source edge
    mutated({forestEdges:[["a","b"],["a","b"]]}), // duplicate
    mutated({forestEdges:[["a","b"],["b","c"]],componentPartition:[["a","b"],["c","d"]]}), // forged partition
    mutated({h1rank:2}), // wrong H1
  ];
  for(const counterfeit of bad){
    assert.throws(()=>graphCertificate.verifyGraphHomologyCertificate(
      counterfeit,{vertices,edges}),/certificate|forest|graph|canonical|rank|source/i);
  }
  // A different valid original source is *not* the graph that was received.
  assert.throws(()=>graphCertificate.verifyGraphHomologyCertificate(cert,{
    vertices,edges:[["a","b"],["b","c"]]
  }),/certificate|forest|graph|source/i);
});

test("all 64 simple four-vertex graphs agree with an independent queue-based component oracle",()=>{
  const vertices=["a","b","c","d"];
  const allEdges=[["a","b"],["a","c"],["a","d"],["b","c"],["b","d"],["c","d"]];
  const independentComponents=(edges)=>{
    const neighbors=new Map(vertices.map(v=>[v,[]]));
    for(const [a,b] of edges){neighbors.get(a).push(b);neighbors.get(b).push(a);}
    const seen=new Set();let count=0;
    for(const first of vertices){
      if(seen.has(first))continue;
      count++;const queue=[first];seen.add(first);
      for(let i=0;i<queue.length;i++)for(const v of neighbors.get(queue[i])){
        if(!seen.has(v)){seen.add(v);queue.push(v);}
      }
    }
    return count;
  };
  for(let mask=0;mask<64;mask++){
    const edges=allEdges.filter((_,i)=>(mask&(1<<i))!==0);
    const cert=graphCertificate.certifiedGraphHomology(vertices,edges);
    const c=independentComponents(edges);
    assert.equal(cert.h0rank,c,"mask "+mask);
    assert.equal(cert.h1rank,edges.length-vertices.length+c,"mask "+mask);
    assert.equal(graphCertificate.verifyGraphHomologyCertificate(
      cert,{vertices,edges}),cert,"mask "+mask);
  }
});

test("a long source-ordered forest is verifiable without recursion or a quadratic adjacency matrix",()=>{
  const vertices=Array.from({length:12000},(_,i)=>"v"+String(i).padStart(5,"0"));
  const edges=vertices.slice(1).map((v,i)=>[vertices[i],v]);
  const cert=graphCertificate.certifiedGraphHomology(vertices,edges);
  assert.equal(cert.forestEdges.length,11999);
  assert.equal(cert.h0rank,1);
  assert.equal(cert.h1rank,0);
  assert.equal(graphCertificate.verifyGraphHomologyCertificate(cert,{vertices,edges}),cert);
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
