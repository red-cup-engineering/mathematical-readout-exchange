import assert from "node:assert/strict";
import test from "node:test";

import { userRmnMessage } from "@red-cup-engineering/a2a-rmn-part-service";
import { executeA2aMessage } from "../scripts/execute-a2a-task.mjs";
import {
  decodeSiloxaneZeoliteRigidityResult,
  encodeSiloxaneZeoliteRigidityRequest,
  executeSiloxaneZeoliteRigidityReadout,
} from "../src/siloxane-zeolite-rigidity-protocol.mjs";
import {
  generic2dRigidityRank,
  runSiloxaneZeoliteRigidity,
} from "../src/siloxane-zeolite-rigidity.mjs";

test("the (2,3) pebble game accepts a triangle and rejects one redundant K4 contact", () => {
  assert.deepEqual(generic2dRigidityRank(3, [[0, 1], [1, 2], [0, 2]]), {
    rank: 3,
    accepted: [0, 1, 2],
    rejected: [],
  });
  const k4 = generic2dRigidityRank(4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]);
  assert.equal(k4.rank, 5);
  assert.equal(k4.accepted.length, 5);
  assert.equal(k4.rejected.length, 1);
});

test("the conductivity surrogate reports its exact planar scope without claiming 3-D criticality", () => {
  const result = runSiloxaneZeoliteRigidity({
    conductivityGrid: [[0, 0], [0, 0]],
    sigmaMatrix: 1,
    thresholds: [0.5],
  });
  assert.equal(result.model, "surrogate2d");
  assert.match(result.scope, /4-neighbor planar/u);
  assert.equal(result.sweep[0].contactGraph.spansLeftRight, true);
  assert.equal(result.sweep[0].contactGraph.spansTopBottom, true);
  assert.equal(result.sweep[0].generic2dRigidity.components[0].rigid, false);
  assert.equal(result.limitations.some((value) => value.includes("does not model 3-D")), true);
});

test("canonical RMN rigidity requests replay identically and cross the existing A2A face", async () => {
  const request = encodeSiloxaneZeoliteRigidityRequest({
    conductivityGrid: [[0, 0.25], [0.5, 1]],
    sigmaMatrix: 1,
    thresholds: [0.25, 0.75],
  });
  const first = executeSiloxaneZeoliteRigidityReadout(request.bytes);
  const replay = executeSiloxaneZeoliteRigidityReadout(request.bytes);
  assert.equal(first.id, replay.id);
  assert.deepEqual(
    decodeSiloxaneZeoliteRigidityResult(first.bytes).value,
    decodeSiloxaneZeoliteRigidityResult(replay.bytes).value,
  );

  const response = await executeA2aMessage(userRmnMessage(request.bytes, "siloxane-zeolite-rigidity-request.rmn.cbor"));
  assert.equal(response.metadata.disposition, "completion");
  assert.equal(response.metadata.requestNi, request.id);
  assert.equal(response.metadata.responseNi, first.id);
  const result = decodeSiloxaneZeoliteRigidityResult(Buffer.from(response.parts[0].raw, "base64"));
  assert.equal(result.value.model, "surrogate2d");
});
