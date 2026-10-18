import {
  decodeRelationalValue,
  encodeRelationalValue,
} from "@red-cup-engineering/relation-model-notation-runtime/relational-value";
import {
  decodeSemantic,
  semanticBytes,
} from "@red-cup-engineering/relation-model-notation-runtime";
import {
  runSiloxaneZeoliteRigidity,
  validateSiloxaneZeoliteRigidityInput,
} from "./siloxane-zeolite-rigidity.mjs";
import { jsonId } from "./semantic-identity.mjs";

export const SILOXANE_ZEOLITE_RIGIDITY = Object.freeze({
  input: "SiloxaneZeoliteRigiditySurrogate2dRequest.v1",
  output: "SiloxaneZeoliteRigiditySurrogate2dResult.v1",
});

function encode(value, objectKind) {
  const relational = encodeRelationalValue(value);
  const term = ["ascribe", relational.type, relational.term];
  return { bytes: semanticBytes(term), id: jsonId(term, objectKind), term };
}

function decode(bytes) {
  const source = Buffer.from(bytes);
  const term = decodeSemantic(source);
  if (!semanticBytes(term).equals(source) || term?.[0] !== "ascribe" || term.length !== 3) {
    const error = new Error("siloxane-zeolite input is not one canonical typed RMN value");
    error.code = "non-canonical-rmn";
    throw error;
  }
  return { term, value: decodeRelationalValue(term[1], term[2]) };
}

export function encodeSiloxaneZeoliteRigidityRequest(input) {
  const normalized = validateSiloxaneZeoliteRigidityInput(input);
  return encode({
    kind: SILOXANE_ZEOLITE_RIGIDITY.input,
    conductivityGrid: normalized.grid,
    sigmaMatrix: normalized.sigmaMatrix,
    thresholds: normalized.thresholds,
    // Omitted for legacy requests to retain their canonical RMN identity.
    ...(normalized.structuralContacts === null ? {} : { structuralContacts: normalized.structuralContacts }),
  }, "lenticule.mathematical-readout.siloxane-zeolite-request");
}

export function executeSiloxaneZeoliteRigidityReadout(bytes) {
  const input = decode(bytes);
  const { kind, ...request } = input.value ?? {};
  if (kind !== SILOXANE_ZEOLITE_RIGIDITY.input) {
    const error = new Error(`siloxane-zeolite readout requires ${SILOXANE_ZEOLITE_RIGIDITY.input}`);
    error.code = "wrong-die-input";
    throw error;
  }
  const result = encode({ kind: SILOXANE_ZEOLITE_RIGIDITY.output, ...runSiloxaneZeoliteRigidity(request) }, "lenticule.mathematical-readout.siloxane-zeolite-result");
  return { inputId: jsonId(input.term, "lenticule.mathematical-readout.siloxane-zeolite-request"), ...result };
}

export function decodeSiloxaneZeoliteRigidityResult(bytes) {
  const decoded = decode(bytes);
  if (decoded.value?.kind !== SILOXANE_ZEOLITE_RIGIDITY.output) {
    const error = new Error(`siloxane-zeolite output is not ${SILOXANE_ZEOLITE_RIGIDITY.output}`);
    error.code = "wrong-die-output";
    throw error;
  }
  return decoded;
}
