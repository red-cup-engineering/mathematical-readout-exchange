import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERIC_2D_PEBBLE_MODEL,
  dischargeGeneric2dPebbleJudgment,
} from "../src/generic-2d-pebble-judgment.mjs";

test("an explicit named contact graph discharges the SXC-M4 pebble-judgment shape", () => {
  const judgment = dischargeGeneric2dPebbleJudgment({
    atomId: "reply",
    vertices: ["root", "reply"],
    contacts: [["reply", "root"]],
  });
  assert.deepEqual(judgment.accepted, [["reply", "root"]]);
  assert.deepEqual(judgment.rejected, []);
  assert.deepEqual(judgment.vertices, ["reply", "root"]);
  assert.equal(judgment.model, GENERIC_2D_PEBBLE_MODEL);
  assert.match(judgment.scope, /caller is responsible for causal-cone membership/u);
});

test("the named-contact discharge keeps a redundant K4 contact visible instead of admitting it", () => {
  const judgment = dischargeGeneric2dPebbleJudgment({
    atomId: "d",
    vertices: ["a", "b", "c", "d"],
    contacts: [["a", "b"], ["a", "c"], ["a", "d"], ["b", "c"], ["b", "d"], ["c", "d"]],
  });
  assert.equal(judgment.accepted.length, 5);
  assert.deepEqual(judgment.rejected, [["c", "d"]]);
});

test("the discharge refuses to invent an atom contact or a vertex correspondence", () => {
  assert.throws(() => dischargeGeneric2dPebbleJudgment({
    atomId: "reply", vertices: ["root", "reply"], contacts: [["root", "other"]],
  }), /listed vertices/u);
  assert.throws(() => dischargeGeneric2dPebbleJudgment({
    atomId: "reply", vertices: ["root", "reply"], contacts: [["root", "root"]],
  }), /distinct/u);
});
