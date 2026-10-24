import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { readBoundedGraph, runReadout } from "../scripts/readout-relational-graph.mjs";

const cli=fileURLToPath(new URL("../scripts/readout-relational-graph.mjs",import.meta.url));
const invoke=(input,flags=[])=>spawnSync(process.execPath,[cli,...flags],{input,encoding:"utf8",timeout:8000,maxBuffer:6*1024*1024});

test("trusted math consumers get an exact JSON computation through the real executable",()=>{
  const result=invoke(JSON.stringify({vertices:["a","b","c","d"],edges:[["a","b"],["a","c"],["b","c"]]}));
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stderr,"");
  const value=JSON.parse(result.stdout);
  assert.deepEqual(value,{
    kind:"obsmetrologia.normalized-graph-local-readout/v1",
    entities:4,cells:3,components:2,exactRank:2,harmonicRank:1,
    componentPartition:[["a","b","c"],["d"]],h0rank:2,h1rank:1
  });
  assert.deepEqual(runReadout({vertices:["a","b"],edges:[["a","b"]]}).componentPartition,[["a","b"]]);
});

test("the executable refuses malformed or unnormalized requests without leaking output",()=>{
  for(const source of [
    "",
    "not JSON",
    JSON.stringify({vertices:["b","a"],edges:[]}),
    JSON.stringify({vertices:["a","b"],edges:[["b","a"]]}),
    JSON.stringify({vertices:["a","b"],edges:[],command:"execute-code"})
  ]){
    const result=invoke(source);
    assert.notEqual(result.status,0,source);
    assert.equal(result.stdout,"",source);
    assert.match(result.stderr,/refused/i);
  }
});


test("the original executable delivers an optional source-verified mathematical certificate",()=>{
  const graph={vertices:["a","b","c","d"],edges:[["a","b"],["a","c"],["b","c"]]};
  const certified=invoke(JSON.stringify(graph),["--certificate"]);
  assert.equal(certified.status,0,certified.stderr);
  const certificate=JSON.parse(certified.stdout);
  assert.equal(certificate.kind,"NormalizedGraphHomologyCertificate.v1");
  assert.deepEqual(certificate.forestEdges,[["a","b"],["a","c"]]);
  assert.deepEqual([certificate.h0rank,certificate.h1rank],[2,1]);
  const {verifyGraphHomologyCertificate}=await import("../src/normalized-graph.mjs");
  assert.equal(verifyGraphHomologyCertificate(certificate,graph),certificate);
  const ordinary=JSON.parse(invoke(JSON.stringify(graph)).stdout);
  assert.equal(ordinary.kind,"obsmetrologia.normalized-graph-local-readout/v1");
  assert.equal(Object.hasOwn(ordinary,"forestEdges"),false);
});
test("unknown CLI options cannot turn a mathematical proof claim into code execution",()=>{
  const input=JSON.stringify({vertices:["a"],edges:[]});
  for(const flags of [["--eval"],["--certificate","--unknown"],["--run","arbitrary"]]){
    const result=invoke(input,flags);
    assert.notEqual(result.status,0);
    assert.equal(result.stdout,"");
  }
});

test("bounded ingress rejects oversize input and shape before computation",async()=>{
  await assert.rejects(()=>readBoundedGraph(Readable.from(["{bad"])),/must be JSON/);
  await assert.rejects(()=>readBoundedGraph(Readable.from([Buffer.alloc(10*1024*1024+1,65)])),/10 MiB/);
  const vertices=Array.from({length:100001},(_,i)=>"v"+i);
  await assert.rejects(()=>readBoundedGraph(Readable.from([JSON.stringify({vertices,edges:[]})])),/size profile/);
});
