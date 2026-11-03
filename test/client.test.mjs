import assert from "node:assert/strict";
import test from "node:test";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { requestRelationalGraphReadout } from "../src/client.mjs";
import { executeRelationalGraphReadout, decodeRelationalGraphResult, encodeRelationalGraphResult } from "../src/relational-graph-protocol.mjs";
import { verifyGraphHomologyCertificate } from "../src/normalized-graph.mjs";

test("public client sends a normalized graph and decodes provider-derived components", async () => {
  const observed = await requestRelationalGraphReadout({
    agentUrl: "https://readout.example/.well-known/agent-card.json",
    graph: { vertices: ["a", "b", "c", "d"], edges: [["a", "b"], ["b", "c"]] },
    send: async ({ message }) => {
      const source = Message.fromJSON(message);
      const input = extractRmnPart(source.parts);
      const result = executeRelationalGraphReadout(input.bytes);
      return { result: Message.fromJSON(Message.toJSON({ messageId: "result", contextId: "", taskId: "", role: Role.ROLE_AGENT, parts: [rmnPart(result.bytes, "relational-graph-result.rmn.cbor")], metadata: { disposition: "completion", resourceEffects: { settled: false } }, extensions: [], referenceTaskIds: [] })) };
    },
  });
  assert.equal(observed.components, 2);
  assert.equal(observed.h0rank, 2);
  assert.equal(observed.h1rank, 0);
  assert.deepEqual(observed.componentPartition, [["a", "b", "c"], ["d"]]);
  assert.match(observed.request, /^ni:\/\/\/sha-256;/u);
  assert.match(observed.result, /^ni:\/\/\/sha-256;/u);
  assert.deepEqual(observed.effects, { settled: false });
});


test("client requests one mathematical certificate and independently verifies the exact sent source", async()=>{
 const graph={vertices:["a","b","c","d"],edges:[["a","b"],["a","c"],["b","c"]]};
 const observed=await requestRelationalGraphReadout({
  agentUrl:"https://readout.example/.well-known/agent-card.json",
  graph,certificate:true,
  send:async ({message})=>{
   const source=Message.fromJSON(message);
   const input=extractRmnPart(source.parts);
   const result=executeRelationalGraphReadout(input.bytes);
   return {result:Message.fromJSON(Message.toJSON({
    messageId:"certified",contextId:"",taskId:"",role:Role.ROLE_AGENT,
    parts:[rmnPart(result.bytes,"relational-graph-certificate.rmn.cbor")],
    metadata:{disposition:"completion",resourceEffects:{settled:false}},
    extensions:[],referenceTaskIds:[]
   }))};
  }
 });
 assert.equal(observed.kind,"NormalizedGraphHomologyCertificate.v1");
 assert.deepEqual(observed.forestEdges,[["a","b"],["a","c"]]);
 const {request,result,effects,...pureCertificate}=observed;
 assert.equal(verifyGraphHomologyCertificate(pureCertificate,graph),pureCertificate);
 assert.equal(effects.settled,false);
});

test("client refuses a self-consistent H0/H1 claim with a forged forest before customer acceptance",async()=>{
 const graph={vertices:["a","b","c","d"],edges:[["a","b"],["a","c"],["b","c"]]};
 await assert.rejects(()=>requestRelationalGraphReadout({
  agentUrl:"https://readout.example/.well-known/agent-card.json",
  graph,certificate:true,
  send:async ({message})=>{
   const source=Message.fromJSON(message);
   const actual=executeRelationalGraphReadout(extractRmnPart(source.parts).bytes);
   const value=decodeRelationalGraphResult(actual.bytes).value;
   const falsified=encodeRelationalGraphResult({...value,forestEdges:[["a","b"]]});
   return {result:Message.fromJSON(Message.toJSON({
    messageId:"falsified",contextId:"",taskId:"",role:Role.ROLE_AGENT,
    parts:[rmnPart(falsified.bytes,"relational-graph-certificate.rmn.cbor")],
    metadata:{disposition:"completion",resourceEffects:{settled:false}},
    extensions:[],referenceTaskIds:[]
   }))};
  }
 }),/graph certificate|forest|source|rank/i);
});

