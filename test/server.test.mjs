import assert from "node:assert/strict";
import { test } from "node:test";

import { attestMathematicalSources, computeCoverNerve, handleRpc } from "../src/server.mjs";

test("admitted mathematical source bytes still match", () => {
  const attestation = attestMathematicalSources();
  assert.equal(attestation.sources.every((source) => source.matches), true);
  assert.match(attestation.assurance.limitation, /not a formally verified extraction/);
});

test("regression vectors match the Lean conformance examples", () => {
  assert.deepEqual(computeCoverNerve({ entities: 1, cells: 0, components: 1 }), {
    h0rank: 1, h1rank: 0, coordinationFree: true, landauerBits: 0, coordinationCost: 0,
  });
  assert.deepEqual(computeCoverNerve({ entities: 3, cells: 3, components: 1 }), {
    h0rank: 1, h1rank: 1, coordinationFree: false, landauerBits: 1, coordinationCost: 1,
  });
  assert.deepEqual(computeCoverNerve({ entities: 6, cells: 7, components: 2 }), {
    h0rank: 2, h1rank: 3, coordinationFree: false, landauerBits: 3, coordinationCost: 3,
  });
});

test("inadmissible counts are refused", () => {
  assert.throws(() => computeCoverNerve({ entities: 4, cells: 1, components: 1 }), /not an admissible CoverNerve/);
});

test("RPC handler returns a qualified result", () => {
  const body = handleRpc({ jsonrpc: "2.0", id: 7, method: "obsmetrologia.coverNerve.rank", params: { entities: 3, cells: 3, components: 1 } });
  assert.equal(body.result.h1rank, 1);
  assert.equal(body.result.certificate.assurance.kind, "source-pinned-executable-projection");
  assert.equal(body.result.cost.settled, false);
});

test("RPC handler emits a typed refusal", () => {
  const body = handleRpc({ jsonrpc: "2.0", id: 8, method: "obsmetrologia.coverNerve.rank", params: { entities: 4, cells: 1, components: 1 } });
  assert.equal(body.error.code, -32602);
});
