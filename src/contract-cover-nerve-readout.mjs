#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { semanticId } from "@emsenn/rmn-semantic-conformance";
import { encodeRelationalValue } from "@emsenn/rmn-semantic-conformance/relational-value";
import { createSettlementStore } from "@emsenn/rwil-rdf-services/client";

import { COVER_NERVE_READOUT_CONTRACT } from "./law.mjs";
import { attestMathematicalSources, computeCoverNerve } from "./server.mjs";

const CONTEXT = "https://www.w3.org/ns/activitystreams";
const ACTOR = "urn:ame:mathematical-readout-exchange";
const NODE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EFFECTS = ["provider-local-rwil-evidence"];

export function semanticDigest(value) {
  const relational = encodeRelationalValue(value);
  return semanticId(["ascribe", relational.type, relational.term]);
}
function identify(body) { return { id: semanticDigest(body), ...body }; }
function contentValid(value) { const { id: _id, ...body } = value ?? {}; return value?.id === semanticDigest(body); }
function operation() {
  const index = process.argv.indexOf("--operation");
  if (index >= 0) return process.argv[index + 1];
  const invoked = basename(process.argv[1] ?? "");
  return invoked === "solicit-service" || invoked === "invoke-service" ? invoked : "invoke-service";
}
function instant() { const index = process.argv.indexOf("--now"); return index >= 0 ? process.argv[index + 1] : new Date().toISOString(); }
function response(type, source, object, at) {
  return identify({ "@context": CONTEXT, type, actor: ACTOR, target: source?.actor ?? null,
    inReplyTo: source?.id ?? null, law: COVER_NERVE_READOUT_CONTRACT, object, published: at });
}
async function append(store, category, record) {
  await store.record({ category: `cover-nerve-readout-${category}`, recordedAt: record.published ?? record.recordedAt, record });
}
async function reject(store, source, reason, at) {
  const value = response("Reject", source, { type: "CoverNerveReadoutRefusal", law: COVER_NERVE_READOUT_CONTRACT,
    reason, prohibitedEffectsPerformed: false, customerMutation: false, foreignMutation: false }, at);
  await append(store, "refusals", value); return value;
}
function isNat(value) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }

export function requestProblem(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)
      || Object.keys(request).some((key) => !["entities", "cells", "components", "authority"].includes(key))) {
    return "request must carry only entities, cells, components, and authority";
  }
  if (![request.entities, request.cells, request.components].every(isNat)) return "entities, cells, and components must be non-negative safe integers";
  if (request.components > request.entities) return "components must be no greater than entities";
  if (request.entities > request.cells + request.components) return "entities must be no greater than cells plus components";
  if (!request.authority || typeof request.authority.controller !== "string" || request.authority.controller.trim() === ""
      || typeof request.authority.basis !== "string" || request.authority.basis.trim() === ""
      || Object.keys(request.authority).some((key) => !["controller", "basis"].includes(key))) {
    return "authority must carry only non-empty controller and basis";
  }
  return null;
}
function solicitationProblem(activity) {
  if (activity?.["@context"] !== CONTEXT || activity.type !== "Offer" || activity.target !== ACTOR
      || activity.object?.type !== "ServiceSolicitation") return "solicitation must be an ActivityStreams Offer<ServiceSolicitation> addressed to Mathematical Readout Exchange";
  if (activity.object.contract !== COVER_NERVE_READOUT_CONTRACT) return "solicitation must name the exact normalized RMN law";
  return requestProblem(activity.object.request);
}
async function solicit(store, activity, at) {
  const invalid = solicitationProblem(activity); if (invalid) return reject(store, activity, invalid, at);
  const request = structuredClone(activity.object.request);
  const terms = { type: "UnpricedServiceTerms", law: COVER_NERVE_READOUT_CONTRACT, assetPaymentRequired: false,
    resourceMeasures: ["compute-seconds", "wall-time-seconds"], witInterchangeabilityClaimed: false,
    erasureInterchangeabilityClaimed: false, gasInterchangeabilityClaimed: false };
  const object = { type: "ExecutableServiceOffer", law: COVER_NERVE_READOUT_CONTRACT, sourceActivity: activity.id,
    request, requestDigest: semanticDigest(request), terms, termsDigest: semanticDigest(terms), operation: "invoke-service",
    effects: EFFECTS, evidence: ["source-attestation", "provider-local-rwil-evidence", "typed-resource-measures", "completion-or-typed-refusal"] };
  const offer = response("Offer", activity, object, at); await append(store, "offers", offer); return offer;
}
function invocationProblem(activity) {
  if (activity?.["@context"] !== CONTEXT || activity.type !== "Accept" || activity.target !== ACTOR) return "invocation must be an ActivityStreams Accept addressed to Mathematical Readout Exchange";
  const contract = activity.object; const offer = contract?.offer; const terms = offer?.object?.terms;
  if (contract?.type !== "ServiceContract" || contract.law !== COVER_NERVE_READOUT_CONTRACT) return "invocation must accept the exact normalized RMN law";
  if (offer?.type !== "Offer" || offer.actor !== ACTOR || offer.law !== COVER_NERVE_READOUT_CONTRACT || !contentValid(offer)
      || offer.object?.type !== "ExecutableServiceOffer" || offer.object.law !== COVER_NERVE_READOUT_CONTRACT) return "ServiceContract must carry this provider's exact authored offer";
  if (offer.object.requestDigest !== semanticDigest(offer.object.request)) return "accepted request differs from provider-authored term";
  if (offer.object.termsDigest !== semanticDigest(terms) || contract.termsAcceptance?.termDigest !== offer.object.termsDigest) return "customer did not accept the provider-authored terms";
  const capability = contract.capability;
  if (capability?.type !== "Capability" || capability.holder !== ACTOR || capability.invocationTarget !== ACTOR) return "invocation requires a capability held by this provider";
  if (capability.parentOffer !== offer.id || capability.attenuation?.requestDigest !== offer.object.requestDigest) return "capability is not attenuated to the accepted offer";
  if (capability.capTP?.target !== ACTOR || capability.capTP.method !== "invoke-service" || !(capability.allowedActions ?? []).includes("invoke-service")) return "capability does not authorize the exact invoke-service method";
  if (!EFFECTS.every((effect) => (capability.allowedActions ?? []).includes(effect)) || (capability.allowedActions ?? []).includes("customer-write")) return "capability must permit only provider-local RWIL evidence";
  return null;
}
async function invoke(store, activity, at) {
  const invalid = invocationProblem(activity); if (invalid) return reject(store, activity, invalid, at);
  const offer = activity.object.offer; const request = offer.object.request;
  const wallStart = process.hrtime.bigint(); const cpuStart = process.cpuUsage();
  let result;
  try { result = { ...computeCoverNerve(request), certificate: attestMathematicalSources() }; }
  catch (error) { return reject(store, activity, `readout-could-not-settle:${error.message}`, at); }
  const cpu = process.cpuUsage(cpuStart);
  const resources = { type: "TypedResourceVector", computeSeconds: (cpu.user + cpu.system) / 1e6,
    wallTimeSeconds: Number(process.hrtime.bigint() - wallStart) / 1e9, assetAmount: null, wit: null, erasure: null, gas: null };
  const exchange = identify({ type: "CoverNerveReadout", law: COVER_NERVE_READOUT_CONTRACT, outcome: "completion",
    request, requestDigest: offer.object.requestDigest, result, resources, recordedAt: at,
    customerMutation: false, foreignMutation: false });
  const receipt = identify({ type: "ServicePerformanceReceipt", law: COVER_NERVE_READOUT_CONTRACT, provider: ACTOR,
    customer: activity.actor, offer: offer.id, invocation: activity.id, fulfillment: exchange.id,
    outcome: exchange.outcome, recordedAt: at, assetSettlementClaimed: false });
  const reply = response("Accept", activity, { type: "CoverNerveReadoutResult", law: COVER_NERVE_READOUT_CONTRACT,
    exchange, receipt, customerMutation: false, foreignMutation: false }, at);
  await append(store, "readouts", exchange); await append(store, "receipts", receipt); await append(store, "results", reply);
  return reply;
}

export async function run(activity, op = "invoke-service", at = new Date().toISOString(), options = {}) {
  const dataRoot = resolve(options.dataRoot ?? process.env.MATHEMATICAL_READOUT_EXCHANGE_DATA_ROOT ?? join(NODE_ROOT, "data"));
  const store = createSettlementStore({ settlementRoot: NODE_ROOT, dataRoot, agentUrl: options.agentUrl ?? process.env.RWIL_RDF_AGENT });
  if (op === "solicit-service") return solicit(store, activity, at);
  if (op === "invoke-service") return invoke(store, activity, at);
  return reject(store, activity, `unknown-provider-operation:${op}`, at);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = await run(JSON.parse(readFileSync(0, "utf8")), operation(), instant());
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`); if (output.type === "Reject") process.exitCode = 2;
  } catch (error) { process.stderr.write(`mathematical-readout-exchange: ${error.message}\n`); process.exitCode = 1; }
}
