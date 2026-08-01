import {
  decodeRelationalValue,
  encodeRelationalValue,
} from "@red-cup-engineering/rmn-semantic-conformance-die/relational-value";
import {
  decodeSemantic,
  semanticBytes,
  semanticId,
} from "@red-cup-engineering/rmn-semantic-conformance-die";
import {
  runSiloxaneZeoliteRigidity,
  validateSiloxaneZeoliteRigidityInput,
} from "./siloxane-zeolite-rigidity.mjs";

export const SILOXANE_ZEOLITE_RIGIDITY = Object.freeze({
  input: "SiloxaneZeoliteRigiditySurrogate2dRequest.v1",
  output: "SiloxaneZeoliteRigiditySurrogate2dResult.v1",
});

function encode(value) {
  const relational = encodeRelationalValue(value);
  const term = ["ascribe", relational.type, relational.term];
  return { bytes: semanticBytes(term), id: semanticId(term), term };
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
  });
}

export function executeSiloxaneZeoliteRigidityReadout(bytes) {
  const input = decode(bytes);
  const { kind, ...request } = input.value ?? {};
  if (kind !== SILOXANE_ZEOLITE_RIGIDITY.input) {
    const error = new Error(`siloxane-zeolite readout requires ${SILOXANE_ZEOLITE_RIGIDITY.input}`);
    error.code = "wrong-die-input";
    throw error;
  }
  const result = encode({ kind: SILOXANE_ZEOLITE_RIGIDITY.output, ...runSiloxaneZeoliteRigidity(request) });
  return { inputId: semanticId(input.term), ...result };
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
