import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { digest, run } from "../src/contract-cover-nerve-readout.mjs";

const CONTEXT = "https://www.w3.org/ns/activitystreams";
const PROVIDER = "urn:ame:mathematical-readout-exchange";
const BUYER = "urn:ame:test-union-customer";
const AT = "2026-07-18T16:00:00.000Z";
function solicitation(request = { entities: 3, cells: 3, components: 1, authority: { controller: BUYER, basis: "test fixture" } }) {
  return { "@context": CONTEXT, id: "urn:test:readout-solicitation", type: "Offer", actor: BUYER, target: PROVIDER, object: { type: "ServiceSolicitation", contract: "cover-nerve-readout", request } };
}
function acceptance(offer, overrides = {}) {
  return {
    "@context": CONTEXT, id: "urn:test:readout-acceptance", type: "Accept", actor: BUYER, target: PROVIDER,
    object: {
      type: "ServiceContract", contract: "cover-nerve-readout", offer,
      considerationAcceptance: { termDigest: offer.object.considerationDigest },
      capability: { type: "Capability", holder: PROVIDER, invocationTarget: PROVIDER, parentOffer: offer.id, attenuation: { requestDigest: offer.object.requestDigest }, capTP: { target: PROVIDER, method: "invoke-service" }, allowedActions: ["invoke-service", "provider-local-write"] },
      ...overrides,
    },
  };
}
function records(root, pool, type) {
  const dir = join(root, pool, type, "2026", "07", "18");
  return readdirSync(dir).flatMap((name) => readFileSync(join(dir, name), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse));
}

test("union ActivityStreams encounter settles a source-attested readout and provider-local books", (t) => {
  const root = mkdtempSync(join(tmpdir(), "math-readout-contract-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { MATHEMATICAL_READOUT_EXCHANGE_DATA_ROOT: root };
  const offer = run(solicitation(), "solicit-service", AT, env);
  assert.equal(offer.type, "Offer"); assert.equal(offer.object.requestDigest, digest(offer.object.request));
  const result = run(acceptance(offer), "invoke-service", AT, env);
  assert.equal(result.type, "Accept"); assert.equal(result.object.exchange.result.h1rank, 1);
  assert.equal(result.object.exchange.result.certificate.assurance.kind, "source-pinned-executable-projection");
  assert.equal(result.object.receipt.seller, PROVIDER); assert.equal(result.object.customerTerritoryMutation, false);
  assert.equal(records(root, "records", "readouts").length, 1);
  assert.equal(records(root, "records", "receipts").length, 1);
  assert.equal(records(root, "records", "books").length, 1);
  assert.ok(records(root, "journals", "eavt").length >= 1);
});

test("inadmissible nerve counts are refused during solicitation", (t) => {
  const root = mkdtempSync(join(tmpdir(), "math-readout-refusal-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = run(solicitation({ entities: 4, cells: 1, components: 1, authority: { controller: BUYER, basis: "test" } }), "solicit-service", AT, { MATHEMATICAL_READOUT_EXCHANGE_DATA_ROOT: root });
  assert.equal(result.type, "Reject"); assert.match(result.object.reason, /entities must be no greater/);
});

test("altered provider terms are refused without a readout", (t) => {
  const root = mkdtempSync(join(tmpdir(), "math-readout-altered-test-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { MATHEMATICAL_READOUT_EXCHANGE_DATA_ROOT: root };
  const offer = run(solicitation(), "solicit-service", AT, env);
  const result = run(acceptance(offer, { considerationAcceptance: { termDigest: "sha256:changed" } }), "invoke-service", AT, env);
  assert.equal(result.type, "Reject"); assert.throws(() => records(root, "records", "readouts"));
});
