#!/usr/bin/env node
// Local, bounded math readout for existing 561 Group offices. It consumes
// normalized JSON, not arbitrary code, and does not expose an HTTP listener
// or claim the signed A2A/CBOR service authority.
import { normalizedGraphSummary } from "../src/normalized-graph.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT_BYTES=10*1024*1024;
const LIMIT_VERTICES=100_000;
const LIMIT_EDGES=300_000;

export async function readBoundedGraph(stream){
  const chunks=[];
  let n=0;
  for await(const chunk of stream){
    const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    n+=b.length;
    if(n>LIMIT_BYTES)throw new RangeError("graph request exceeds 10 MiB");
    chunks.push(b);
  }
  if(n===0)throw new TypeError("graph request is empty");
  let request;
  try{request=JSON.parse(Buffer.concat(chunks,n).toString("utf8"))}
  catch{throw new TypeError("graph request must be JSON")}
  if(!request||typeof request!=="object"||Array.isArray(request)||
     Object.keys(request).sort().join(",")!=="edges,vertices")
    throw new TypeError("graph request must contain exactly vertices and edges");
  if(!Array.isArray(request.vertices)||!Array.isArray(request.edges))
    throw new TypeError("graph vertices and edges must be arrays");
  if(request.vertices.length>LIMIT_VERTICES||request.edges.length>LIMIT_EDGES)
    throw new RangeError("graph exceeds local readout size profile");
  return request;
}

export function runReadout({vertices,edges}){
  const result=normalizedGraphSummary(vertices,edges);
  return Object.freeze({
    kind:"obsmetrologia.normalized-graph-local-readout/v1",
    ...result,
    h0rank:result.components,
    h1rank:result.harmonicRank
  });
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){
    console.error("usage: readout-relational-graph < normalized-graph.json");
    process.exitCode=2;
  }else try{
    const graph=await readBoundedGraph(process.stdin);
    process.stdout.write(JSON.stringify(runReadout(graph))+"\n");
  }catch(error){
    console.error("graph readout refused: "+error.message);
    process.exitCode=1;
  }
}
