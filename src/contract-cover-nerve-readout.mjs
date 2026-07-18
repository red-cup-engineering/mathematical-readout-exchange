#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { attestMathematicalSources, computeCoverNerve } from "./server.mjs";

const CONTEXT = "https://www.w3.org/ns/activitystreams";
const ACTOR = "urn:ame:mathematical-readout-exchange";
const CONTRACT = "cover-nerve-readout";
const NODE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function digest(value) {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

function contentId(value) { return `urn:${digest(value)}`; }
function operation() {
  const index = process.argv.indexOf("--operation");
  if (index >= 0) return process.argv[index + 1];
  const invoked = basename(process.argv[1] ?? "");
  return invoked === "solicit-service" || invoked === "invoke-service" ? invoked : "invoke-service";
}
function instant() {
  const index = process.argv.indexOf("--now");
  return index >= 0 ? process.argv[index + 1] : new Date().toISOString();
}
function dataRoot(env = process.env) { return resolve(env.MATHEMATICAL_READOUT_EXCHANGE_DATA_ROOT ?? join(NODE_ROOT, "data")); }
function dated(root, pool, type, at) {
  const day = at.slice(0, 10); const [year, month, date] = day.split("-");
  return join(root, pool, type, year, month, date, `${day}-mathematical-readout-exchange-${type}.jsonl`);
}
function append(root, pool, type, value, at) {
  const path = dated(root, pool, type, at); mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(value)}\n`, "utf8"); return path;
}
function response(type, source, object) {
  return { "@context": CONTEXT, id: contentId({ actor: ACTOR, type, inReplyTo: source?.id ?? null, object }), type, actor: ACTOR, target: source?.actor ?? null, inReplyTo: source?.id ?? null, object };
}
function witness(root, source, outcome, at, details = {}) {
  const body = { source: ACTOR, type: `org.emsenn.mathematical-readout-exchange.${outcome}`, subject: source?.id ?? "urn:activity:unidentified", time: at, data: { contract: CONTRACT, activityDigest: digest(source ?? null), ...details } };
  const event = { specversion: "1.0", id: contentId(body), ...body, datacontenttype: "application/json" };
  append(root, "journals", "events", event, at);
  for (const [a, v] of [["activity/outcome", outcome], ["contract/id", CONTRACT], ...Object.entries(details).filter(([, value]) => typeof value === "string")]) {
    append(root, "journals", "eavt", { e: body.subject, a, v, t: event.id }, at);
  }
}
function reject(root, source, reason, at) {
  const value = response("Reject", source, { type: "Refusal", contract: CONTRACT, reason });
  append(root, "journals", "activitystreams", value, at); witness(root, source, "activity.rejected", at, { reason }); return value;
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
  if (activity?.["@context"] !== CONTEXT || activity.type !== "Offer" || activity.target !== ACTOR || activity.object?.type !== "ServiceSolicitation") return "solicitation must be an ActivityStreams Offer<ServiceSolicitation> addressed to Mathematical Readout Exchange";
  if (activity.object.contract !== CONTRACT) return `solicitation must name ${CONTRACT}`;
  return requestProblem(activity.object.request);
}

function solicit(root, activity, at) {
  append(root, "journals", "activitystreams", activity, at);
  const invalid = solicitationProblem(activity); if (invalid) return reject(root, activity, invalid, at);
  const request = structuredClone(activity.object.request);
  const consideration = { type: "InternalValueAgreement", amount: 1, unit: "cover-nerve-readout-credit", settlementProtocol: "bilateral-receipt", x402Applicable: false, rationale: "Internal reciprocal value only; not money or a firm-wide settled denomination." };
  const object = {
    type: "ExecutableServiceOffer", contract: CONTRACT, sourceActivity: activity.id,
    request, requestDigest: digest(request),
    commodity: { type: "ServiceCommodity", id: "urn:commodity:mathematical-readout-exchange:cover-nerve", quantity: 1, unit: "qualified-readout" },
    consideration, considerationDigest: digest(consideration), operation: "invoke-service", effects: ["provider-local-write"],
    evidence: ["source-attestation", "provider-local-readout", "provider-local-receipt", "provider-local-book-entry", "completion-or-typed-refusal"],
  };
  const offer = response("Offer", activity, object);
  append(root, "journals", "activitystreams", offer, at); witness(root, activity, "offer.emitted", at, { offer: offer.id, requestDigest: object.requestDigest }); return offer;
}

function invocationProblem(activity) {
  if (activity?.["@context"] !== CONTEXT || activity.type !== "Accept" || activity.target !== ACTOR) return "invocation must be an ActivityStreams Accept addressed to Mathematical Readout Exchange";
  const contract = activity.object; const offer = contract?.offer;
  if (contract?.type !== "ServiceContract" || contract.contract !== CONTRACT) return `invocation must accept ${CONTRACT}`;
  if (offer?.type !== "Offer" || offer.actor !== ACTOR || offer.object?.type !== "ExecutableServiceOffer" || offer.object.contract !== CONTRACT) return "ServiceContract must carry this provider's authored offer";
  if (offer.object.requestDigest !== digest(offer.object.request)) return "accepted request differs from provider-authored bytes";
  if (offer.object.considerationDigest !== digest(offer.object.consideration)) return "accepted consideration differs from provider-authored bytes";
  if (contract.considerationAcceptance?.termDigest !== offer.object.considerationDigest) return "customer did not accept the provider-authored consideration";
  const capability = contract.capability;
  if (capability?.type !== "Capability" || capability.holder !== ACTOR || capability.invocationTarget !== ACTOR) return "invocation requires a capability held by this provider";
  if (capability.parentOffer !== offer.id || capability.attenuation?.requestDigest !== offer.object.requestDigest) return "capability is not attenuated to the accepted offer";
  if (capability.capTP?.target !== ACTOR || capability.capTP.method !== "invoke-service" || !(capability.allowedActions ?? []).includes("invoke-service")) return "capability does not authorize the exact invoke-service method";
  if (!(capability.allowedActions ?? []).includes("provider-local-write") || (capability.allowedActions ?? []).includes("customer-write")) return "capability must permit only the provider-local effect";
  return null;
}

function invoke(root, activity, at) {
  append(root, "journals", "activitystreams", activity, at);
  const invalid = invocationProblem(activity); if (invalid) return reject(root, activity, invalid, at);
  const offer = activity.object.offer; const request = offer.object.request;
  const wallStart = process.hrtime.bigint(); const cpuStart = process.cpuUsage();
  let result;
  try {
    result = { ...computeCoverNerve(request), certificate: attestMathematicalSources() };
  } catch (error) {
    return reject(root, activity, `readout could not settle: ${error.message}`, at);
  }
  const cpu = process.cpuUsage(cpuStart);
  const cost = { "fuel-consumed": (cpu.user + cpu.system) / 1e6, "wall-time-seconds": Number(process.hrtime.bigint() - wallStart) / 1e9, denomination: "mathematical-readout-exchange-cpu-seconds", settled: false };
  const exchange = { id: contentId({ request, result, at }), type: "CoverNerveReadout", outcome: "completion", request, requestDigest: offer.object.requestDigest, result, cost, readAt: at, customerTerritoryMutation: false };
  append(root, "records", "readouts", exchange, at);
  const buyer = activity.actor;
  const receiptCore = { type: "BilateralSettlementReceipt", contract: CONTRACT, seller: ACTOR, buyer, offer: offer.id, acceptedBy: activity.id, commodity: offer.object.commodity, consideration: offer.object.consideration, fulfillmentDigest: digest(exchange), outcome: exchange.outcome, settledAt: at, payment: { protocol: "bilateral-internal-value", x402Receipt: null, monetaryClaim: false } };
  const receipt = { id: contentId(receiptCore), ...receiptCore };
  const sellerEntry = { id: contentId({ side: "seller", receipt: receipt.id }), type: "ValueLedgerEntry", side: "seller", direction: "credit", account: ACTOR, counterparty: buyer, receipt: receipt.id, amount: 1, unit: "cover-nerve-readout-credit", recordedAt: at };
  append(root, "records", "receipts", receipt, at); append(root, "records", "books", sellerEntry, at);
  const reply = response("Accept", activity, { type: "CoverNerveReadoutResult", contract: CONTRACT, exchange, receipt, providerBookEntry: sellerEntry.id, customerTerritoryMutation: false });
  append(root, "journals", "activitystreams", reply, at); witness(root, activity, "contract.completed", at, { receipt: receipt.id, readout: exchange.id }); return reply;
}

export function run(activity, op = "invoke-service", at = new Date().toISOString(), env = process.env) {
  const root = dataRoot(env);
  if (op === "solicit-service") return solicit(root, activity, at);
  if (op === "invoke-service") return invoke(root, activity, at);
  return reject(root, activity, `unknown provider operation ${op}`, at);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = run(JSON.parse(readFileSync(0, "utf8")), operation(), instant());
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`); if (output.type === "Reject") process.exitCode = 2;
  } catch (error) { process.stderr.write(`mathematical-readout-exchange: ${error.message}\n`); process.exitCode = 1; }
}
