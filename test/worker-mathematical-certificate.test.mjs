import { test } from "node:test";
import assert from "node:assert/strict";
import { userRmnMessage } from "@red-cup-engineering/a2a-rmn-part-service";
import { encodeRelationalGraphRequest, decodeRelationalGraphResult,
  RELATIONAL_GRAPH_CERTIFICATE } from "../src/relational-graph-protocol.mjs";
import { verifyGraphHomologyCertificate } from "../src/normalized-graph.mjs";
import worker from "../cloudflare/worker.mjs";

// Native mock HTTP request, actual original Worker/SDK/RMN route. No network,
// account, merchant, wallet, billable compute, deployment or settled Work.
test("Cloudflare A2A JSONRPC serves the original signed mathematical witness result",async()=>{
 const graph={vertices:["a","b","c","d"],edges:[["a","b"],["a","c"],["b","c"]]};
 const encoded=encodeRelationalGraphRequest({...graph,certificate:true});
 const message=userRmnMessage(encoded.bytes,"relational-graph-certificate-request.rmn.cbor");
 const request=new Request("https://readout.example/a2a/jsonrpc",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:"external-original-task",method:"message/send",params:{message}})
 });
 const response=await worker.fetch(request,{});
 assert.equal(response.status,200,await response.text());
 const body=await response.json();
 assert.equal(body.id,"external-original-task");
 assert.equal(body.result.metadata.disposition,"completion");
 assert.equal(body.result.metadata.graphWitness.kernelFormalized,false);
 assert.equal(body.result.metadata.graphWitness.independentlyBuyerVerified,false);
 assert.equal(body.result.metadata.resourceEffects.settled,false);
 const value=decodeRelationalGraphResult(Buffer.from(body.result.parts[0].raw,"base64")).value;
 assert.equal(value.kind,RELATIONAL_GRAPH_CERTIFICATE.output);
 assert.equal(verifyGraphHomologyCertificate(value,graph),value);
});

test("the same deployed route preserves ordinary uncertified V1 mathematical output",async()=>{
 const graph={vertices:["a","b"],edges:[["a","b"]]};
 const request=new Request("https://readout.example/a2a/jsonrpc",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:"v1",method:"message/send",params:{
   message:userRmnMessage(encodeRelationalGraphRequest(graph).bytes,"relational-graph-request.rmn.cbor")
  }})
 });
 const response=await worker.fetch(request,{});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.result.metadata.graphWitness,undefined);
 const value=decodeRelationalGraphResult(Buffer.from(body.result.parts[0].raw,"base64")).value;
 assert.equal(value.kind,"NormalizedRelationalGraphReadoutResult.v1");
 assert.equal(Object.hasOwn(value,"forestEdges"),false);
});
