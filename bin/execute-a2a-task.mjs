#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@emsenn/a2a-rmn-part-service";
import {
  decodeCoverNerveRequest,
  executeCoverNerveDie,
} from "@emsenn/cover-nerve-rank-die";
import { attestMathematicalSources } from "../src/mathematical-source-attestation.mjs";

function exactFraction(numerator, denominator) {
  let num = BigInt(numerator), den = BigInt(denominator), left = num, right = den;
  while (right !== 0n) [left, right] = [right, left % right];
  num /= left; den /= left;
  return Object.freeze({ numerator: num.toString(), denominator: den.toString() });
}

function measuredReadout(inputBytes) {
  const wallStart = process.hrtime.bigint();
  const cpuStart = process.cpuUsage();
  const dieResult = executeCoverNerveDie(inputBytes);
  const cpu = process.cpuUsage(cpuStart);
  const wallNanoseconds = process.hrtime.bigint() - wallStart;
  return {
    dieResult,
    certificate: attestMathematicalSources(),
    resourceEffects: {
      "fuel-consumed": exactFraction(cpu.user + cpu.system, 1_000_000),
      "wall-time-seconds": exactFraction(wallNanoseconds, 1_000_000_000),
      denomination: "mathematical-readout-exchange-cpu-seconds",
      settled: false,
    },
  };
}

export async function executeA2aMessage(source) {
  const message = Message.fromJSON(source);
  if (message.role !== Role.ROLE_USER) throw new Error("mathematical-readout-exchange requires an A2A ROLE_USER message");
  const input = extractRmnPart(message.parts);
  decodeCoverNerveRequest(input.bytes);
  const result = measuredReadout(input.bytes);
  return Message.toJSON({
    messageId: randomUUID(),
    contextId: message.contextId,
    taskId: message.taskId,
    role: Role.ROLE_AGENT,
    parts: [rmnPart(result.dieResult.bytes, "cover-nerve-result.rmn.cbor")],
    metadata: {
      disposition: "completion",
      requestNi: input.ni,
      responseNi: result.dieResult.id,
      mathematicalSourceCertificate: result.certificate,
      resourceEffects: result.resourceEffects,
    },
    extensions: [],
    referenceTaskIds: [],
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const source = JSON.parse(readFileSync(0, "utf8"));
    process.stdout.write(`${JSON.stringify(await executeA2aMessage(source))}\n`);
  } catch (error) {
    process.stderr.write(`${error.code ?? "mathematical-readout-exchange-refusal"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
