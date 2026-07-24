import assert from "node:assert/strict";
import { test } from "node:test";

import { userRmnMessage } from "@emsenn/a2a-rmn-part-service";
import { semanticBytes, decodeSemantic } from "@emsenn/rmn-semantic-conformance";
import { attestMathematicalSources, computeCoverNerve } from "../src/cover-nerve.mjs";
import { executeA2aMessage } from "../bin/execute-a2a-task.mjs";

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

test("non-safe-integer counts are refused", () => {
  assert.throws(() => computeCoverNerve({ entities: 1.5, cells: 1, components: 1 }), /non-negative safe integers/);
});

function requestMessage(payload) {
  return userRmnMessage(semanticBytes(["mark", JSON.stringify(payload)]), "cover-nerve-request.rmn.cbor");
}

test("A2A executor: coverNerve happy path round-trip", async () => {
  const response = await executeA2aMessage(requestMessage({ entities: 3, cells: 3, components: 1 }));
  assert.equal(response.metadata.disposition, "completion");
  const part = response.parts.find((p) => p.mediaType === "application/rmn+cbor");
  assert.ok(part, "response carries one RMN part");
  const term = decodeSemantic(Buffer.from(part.raw, "base64"));
  assert.equal(term[0], "mark");
  const result = JSON.parse(term[1]);
  assert.equal(result.h1rank, 1);
  assert.equal(result.cost.denomination, "mathematical-readout-exchange-cpu-seconds");
  assert.equal(result.certificate.library, "@emsenn/obsmetrologia");
});

test("A2A executor: an inadmissible CoverNerve is refused, not completed", async () => {
  await assert.rejects(
    () => executeA2aMessage(requestMessage({ entities: 4, cells: 1, components: 1 })),
    /not an admissible CoverNerve/,
  );
});

test("A2A executor: a non-Mark request term is refused", async () => {
  const message = userRmnMessage(semanticBytes(["pair", ["mark", "a"], ["mark", "b"]]), "cover-nerve-request.rmn.cbor");
  await assert.rejects(() => executeA2aMessage(message), /one RMN Mark term/);
});
