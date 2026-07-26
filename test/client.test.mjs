import assert from "node:assert/strict";
import test from "node:test";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@emsenn/a2a-rmn-part-service";
import { executeCoverNerveDie } from "@emsenn/cover-nerve-rank-die";
import { requestCoverNerveReadout } from "../src/client.mjs";

test("public client sends the cell's consumed typed carrier and decodes its result", async () => {
  const observed = await requestCoverNerveReadout({
    agentUrl: "https://readout.example/.well-known/agent-card.json",
    nerve: { entities: 3, cells: 3, components: 1 },
    send: async ({ message }) => {
      const source = Message.fromJSON(message);
      const input = extractRmnPart(source.parts);
      const result = executeCoverNerveDie(input.bytes);
      return { result: Message.fromJSON(Message.toJSON({ messageId: "result", contextId: "", taskId: "", role: Role.ROLE_AGENT, parts: [rmnPart(result.bytes, "cover-nerve-result.rmn.cbor")], metadata: { disposition: "completion", resourceEffects: { settled: false } }, extensions: [], referenceTaskIds: [] })) };
    },
  });
  assert.equal(observed.h0rank, 1);
  assert.equal(observed.h1rank, 1);
  assert.match(observed.request, /^ni:\/\/\/sha-256;/u);
  assert.match(observed.result, /^ni:\/\/\/sha-256;/u);
  assert.deepEqual(observed.effects, { settled: false });
});
