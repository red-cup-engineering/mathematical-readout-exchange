import { randomUUID } from "node:crypto";
import { userRmnMessage, extractRmnPart } from "@emsenn/a2a-rmn-part-service";
import { a2aResultMetadata, a2aResultParts, sendRmnTask } from "../../../../../../red-cup-engineering/services/web-services-section/services/a2a-services-section/services/a2a-rmn-task-client-service/src/send-rmn-task.mjs";
import { SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION } from "../../../../../../red-cup-engineering/services/model-services-section/services/relational-model-services-section/services/relational-model-notation-services-section/services/rmn-conformance-service/src/hierarchical-circuit.mjs";
import { decodeCoverNerveResult, encodeCoverNerveRequest } from "@emsenn/cover-nerve-rank-die";

export async function requestCoverNerveReadout({ agentUrl, nerve, signal, send = sendRmnTask }) {
  if (typeof agentUrl !== "string" || !/^https?:\/\//u.test(agentUrl)) throw new Error("one absolute mathematical-readout Agent Card URL is required");
  const request = encodeCoverNerveRequest(nerve);
  const exchange = await send({
    agentUrl,
    extensions: [SOVEREIGN_CIRCUIT_INTERFACE_EXTENSION],
    requireSignature: true,
    message: userRmnMessage(request.bytes, "cover-nerve-request.rmn.cbor", randomUUID()),
    ...(signal ? { signal } : {}),
  });
  if (a2aResultMetadata(exchange.result).disposition !== "completion") throw new Error("mathematical-readout-exchange refused");
  const part = extractRmnPart(a2aResultParts(exchange.result));
  const decoded = decodeCoverNerveResult(part.bytes);
  return Object.freeze({
    ...decoded.value,
    request: request.id,
    result: part.ni,
    effects: a2aResultMetadata(exchange.result).resourceEffects ?? null,
  });
}
