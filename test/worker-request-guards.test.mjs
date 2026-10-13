import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_A2A_JSON_BYTES, MAX_RMN_BYTES,
  ReadoutInputError, readBoundedA2aJson, decodeBoundedRmnRaw, verifiedRequestNi,
} from "../cloudflare/request-guards.mjs";

const endpoint = "https://readout.example/a2a/jsonrpc";
const request = (body, headers = {}) => new Request(endpoint, {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body,
});
const refuses = (code) => (error) => error instanceof ReadoutInputError && error.code === code;

test("streamed JSON decodes normally without requiring a Content-Length", async () => {
  const body = JSON.stringify({ jsonrpc: "2.0", method: "message/send", params: { message: { parts: [] } } });
  const r = request(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); },
  }), { "content-length": undefined });
  assert.equal((await readBoundedA2aJson(r)).method, "message/send");
});

test("declared and streamed oversize bodies are both refused before parsing", async () => {
  const declared = request("{}", { "content-length": String(MAX_A2A_JSON_BYTES + 1) });
  await assert.rejects(() => readBoundedA2aJson(declared), refuses("request-too-large"));
  const chunks = [new Uint8Array(MAX_A2A_JSON_BYTES), new Uint8Array(1)];
  const chunked = request(new ReadableStream({
    start(controller) { chunks.forEach(c => controller.enqueue(c)); controller.close(); },
  }));
  await assert.rejects(() => readBoundedA2aJson(chunked), refuses("request-too-large"));
});

test("malformed inputs fail with client errors rather than a runtime 500", async () => {
  await assert.rejects(() => readBoundedA2aJson(request("{")), refuses("invalid-a2a-json"));
  await assert.rejects(() => readBoundedA2aJson(request("{}", { "content-type": "text/plain" })), refuses("unsupported-media-type"));
  await assert.rejects(() => readBoundedA2aJson(request("")), refuses("empty-a2a-request"));
  const malformedUtf8 = request(new Uint8Array([0xff]));
  await assert.rejects(() => readBoundedA2aJson(malformedUtf8), refuses("invalid-a2a-json"));
});

test("RMN media carries exact decoded bytes and rejects excessive or ambiguous base64", () => {
  assert.deepEqual([...decodeBoundedRmnRaw("AAECAw==")], [0, 1, 2, 3]);
  const max = Buffer.alloc(MAX_RMN_BYTES, 0x42).toString("base64");
  assert.equal(decodeBoundedRmnRaw(max).length, MAX_RMN_BYTES);
  for (const raw of ["", "_", "A", "AQ=", "AQ====", "@@@@", Buffer.alloc(MAX_RMN_BYTES + 1).toString("base64")])
    assert.throws(() => decodeBoundedRmnRaw(raw), ReadoutInputError);
});

test("a sender cannot replace the provider's input content identity", () => {
  const computed = "ni:///sha-256;authoritative";
  assert.equal(verifiedRequestNi(undefined, computed), computed);
  assert.equal(verifiedRequestNi(computed, computed), computed);
  assert.throws(() => verifiedRequestNi("ni:///sha-256;forged", computed), refuses("request-identity-mismatch"));
  assert.throws(() => verifiedRequestNi(undefined, "unverified"), refuses("missing-request-identity"));
});
