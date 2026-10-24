#!/usr/bin/env node
// Original mathematical-readout exchange, now with a directed work-DAG
// operation. No A2A actor, allocation, purchase, or remote network effect.
import { optimizeWorkCriticalIntervention } from "../src/work-critical-intervention.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_INPUT_BYTES = 3 * 1024 * 1024;
export async function receiveWorkCriticalIntervention(stream) {
  const chunks=[];let bytes=0;
  for await(const chunk of stream){
    const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    bytes+=b.length;
    if(bytes>MAX_INPUT_BYTES)throw new RangeError("source Work exceeds the 3 MiB input profile");
    chunks.push(b);
  }
  if(bytes===0)throw new TypeError("missing original Work graph input");
  const data=Buffer.concat(chunks,bytes).toString("utf8");
  // Reject replacement decoding: do not treat two distinct bytestrings as
  // one original signed or source-revision carrier.
  if(Buffer.from(data,"utf8").compare(Buffer.concat(chunks,bytes))!==0)
    throw new TypeError("original Work input must be valid UTF-8");
  let input;
  try { input=JSON.parse(data); }
  catch { throw new TypeError("original Work input must be JSON"); }
  return input;
}
export function runWorkIntervention(request) {
  return optimizeWorkCriticalIntervention(request);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2){
    console.error("usage: readout-work-intervention < source-work-graph.json");
    process.exitCode=2;
  }else try {
    const input=await receiveWorkCriticalIntervention(process.stdin);
    process.stdout.write(JSON.stringify(runWorkIntervention(input))+"\n");
  }catch(error){
    console.error("mathematical work intervention refused: "+error.message);
    process.exitCode=1;
  }
}
