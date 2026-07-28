import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { executeCoverNerveDie } from "@lenticule-science/cover-nerve-rank-readout-service";
import { circuitInterfaceFromAgentCard } from "@lenticule-science/rmn-semantic-conformance-die/hierarchical-circuit";
import { requestCoverNerveReadout, requestRelationalGraphReadout } from "../src/client.mjs";
import { executeRelationalGraphReadout } from "../src/relational-graph-protocol.mjs";

const publishedCard = JSON.parse(readFileSync(new URL("../content/agent-cards/mathematical-readout-exchange.json", import.meta.url), "utf8"));
function normalizedPublishedFace() { return circuitInterfaceFromAgentCard(publishedCard); }

test("the published circuit admits either operation independently without inventing a conjunction", () => {
  const circuit = normalizedPublishedFace();
  const factor = circuit.component.behavior.factors[0];
  assert.deepEqual(factor.inputs, ["coverNerve", "relationalGraph"]);
  assert.deepEqual(factor.outputs, ["readout"]);
  const outputFor = (left, right) => factor.rows.find(({ input }) =>
    input[0].positiveEvidence === left.positiveEvidence
    && input[0].negativeEvidence === left.negativeEvidence
    && input[1].positiveEvidence === right.positiveEvidence
    && input[1].negativeEvidence === right.negativeEvidence).output[0];
  const unknown = { positiveEvidence: false, negativeEvidence: false };
  const trueOnly = { positiveEvidence: true, negativeEvidence: false };
  assert.deepEqual(outputFor(trueOnly, unknown), trueOnly);
  assert.deepEqual(outputFor(unknown, trueOnly), trueOnly);
});

test("public client sends the cell's consumed typed carrier and decodes its result", async () => {
  const observed = await requestCoverNerveReadout({
    agentUrl: "https://readout.example/.well-known/agent-card.json",
    nerve: { entities: 3, cells: 3, components: 1 },
    send: async ({ message }) => {
      normalizedPublishedFace();
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

test("public client sends a normalized graph and decodes provider-derived components", async () => {
  const observed = await requestRelationalGraphReadout({
    agentUrl: "https://readout.example/.well-known/agent-card.json",
    graph: { vertices: ["a", "b", "c", "d"], edges: [["a", "b"], ["b", "c"]] },
    send: async ({ message }) => {
      normalizedPublishedFace();
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
