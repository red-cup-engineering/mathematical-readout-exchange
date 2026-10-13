// Admission for the live A2A Worker, before SDK and CBOR decoding.
// Application budgets, not browser upload limits or mathematical proof claims.
export const MAX_A2A_JSON_BYTES = 1024 * 1024;
export const MAX_RMN_BYTES = 512 * 1024;

export class ReadoutInputError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = "ReadoutInputError";
    this.code = code;
    this.status = status;
  }
}

/** Enforce a real streaming byte ceiling even without a Content-Length header. */
export async function readBoundedA2aJson(request) {
  const media = request.headers.get("content-type");
  if (media !== null && !/^application\/json(?:\s*;|\s*$)/iu.test(media))
    throw new ReadoutInputError("A2A requests must use application/json", "unsupported-media-type", 415);

  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_A2A_JSON_BYTES))
    throw new ReadoutInputError("A2A request exceeds 1 MiB", "request-too-large", 413);
  if (!request.body)
    throw new ReadoutInputError("A2A request body is required", "empty-a2a-request");

  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      bytes += value.byteLength;
      if (bytes > MAX_A2A_JSON_BYTES)
        throw new ReadoutInputError("A2A request exceeds 1 MiB", "request-too-large", 413);
      chunks.push(value);
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  if (bytes === 0)
    throw new ReadoutInputError("A2A request body is required", "empty-a2a-request");
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new ReadoutInputError("A2A request must be valid UTF-8 JSON", "invalid-a2a-json");
  }
}

/** Bound the semantic RMN bytes, not just their base64 wrapper length. */
export function decodeBoundedRmnRaw(raw) {
  if (typeof raw !== "string" || raw.length === 0
      || raw.length > 4 * Math.ceil(MAX_RMN_BYTES / 3) + 4
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(raw))
    throw new ReadoutInputError("invalid or oversized RMN base64 part", "invalid-rmn-part", 413);
  let binary;
  try { binary = atob(raw); }
  catch { throw new ReadoutInputError("invalid RMN base64 part", "invalid-rmn-part"); }
  if (binary.length > MAX_RMN_BYTES)
    throw new ReadoutInputError("RMN part exceeds 512 KiB", "rmn-too-large", 413);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

/** Never echo an untrusted origin claim as the independently computed input ID. */
export function verifiedRequestNi(claimed, computed) {
  if (typeof computed !== "string" || !computed.startsWith("ni:///sha-256;"))
    throw new ReadoutInputError("provider did not compute a semantic request identity", "missing-request-identity");
  if (claimed !== undefined && claimed !== computed)
    throw new ReadoutInputError("request identity does not match decoded RMN bytes", "request-identity-mismatch");
  return computed;
}
