import assert from "node:assert/strict";
import test from "node:test";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { requestRelationalGraphReadout } from "../src/client.mjs";
import { executeRelationalGraphReadout } from "../src/relational-graph-protocol.mjs";

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
