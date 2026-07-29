import { generic2dRigidityRank } from "./siloxane-zeolite-rigidity.mjs";

/**
 * Render the exact generic-planar `(2,3)` judgment consumed by SXC-M4.
 *
 * This is deliberately a contact-graph operation, not a projection of the
 * conductivity-grid surrogate.  Its caller establishes the named contacts
 * and their causal-cone scope; this function only decides their generic 2-D
 * independence.  It makes no 3-D, molecular-dynamics, or DFT claim.
 */
export const GENERIC_2D_PEBBLE_MODEL = "generic-2d-rigidity-(2,3)-pebble-game/v1";

function requireId(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function canonicalContactGraph({ atomId, vertices, contacts }) {
  requireId(atomId, "atomId");
  if (!Array.isArray(vertices) || vertices.length === 0) throw new TypeError("vertices must be a non-empty array");
  const namedVertices = vertices.map((vertex, index) => requireId(vertex, `vertices[${index}]`));
  if (new Set(namedVertices).size !== namedVertices.length || !namedVertices.includes(atomId)) {
    throw new TypeError("vertices must be unique and include atomId");
  }
  if (!Array.isArray(contacts) || contacts.length === 0) throw new TypeError("contacts must be a non-empty array");
  const vertexSet = new Set(namedVertices);
  const canonicalContacts = contacts.map((contact, index) => {
    if (!Array.isArray(contact) || contact.length !== 2) throw new TypeError(`contacts[${index}] must be a pair`);
    const [left, right] = contact.map((vertex, side) => requireId(vertex, `contacts[${index}][${side}]`));
    if (left === right || !vertexSet.has(left) || !vertexSet.has(right)) {
      throw new TypeError(`contacts[${index}] must join two distinct listed vertices`);
    }
    return [left, right].sort();
  });
  const contactKeys = canonicalContacts.map((contact) => JSON.stringify(contact));
  if (new Set(contactKeys).size !== contactKeys.length) throw new TypeError("contacts must be unique undirected pairs");
  canonicalContacts.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (!canonicalContacts.some((contact) => contact.includes(atomId))) {
    throw new TypeError("contacts must include at least one contact incident to atomId");
  }
  return { atomId, vertices: [...namedVertices].sort(), contacts: canonicalContacts };
}

/**
 * @param {{atomId: string, vertices: string[], contacts: [string, string][]}} contactGraph
 * @returns {{model: string, atomId: string, vertices: string[], accepted: string[][], rejected: string[][], scope: string, limitations: string[]}}
 */
export function dischargeGeneric2dPebbleJudgment(contactGraph) {
  const { atomId, vertices, contacts } = canonicalContactGraph(contactGraph ?? {});
  const indexOf = new Map(vertices.map((vertex, index) => [vertex, index]));
  const result = generic2dRigidityRank(vertices.length, contacts.map(([left, right]) => [indexOf.get(left), indexOf.get(right)]));
  return Object.freeze({
    model: GENERIC_2D_PEBBLE_MODEL,
    atomId,
    vertices: Object.freeze([...vertices]),
    accepted: Object.freeze(result.accepted.map((index) => Object.freeze([...contacts[index]]))),
    rejected: Object.freeze(result.rejected.map((index) => Object.freeze([...contacts[index]]))),
    scope: "explicit named contact graph; caller is responsible for causal-cone membership",
    limitations: Object.freeze([
      "This is a generic planar (2,3) pebble-game judgment over the supplied named contacts.",
      "It does not infer contacts from a grid, establish causal-cone membership, or model 3-D structure, molecular dynamics, or DFT.",
    ]),
  });
}
