#!/usr/bin/env node
import { runSiloxaneZeoliteRigidity } from '../src/siloxane-zeolite-rigidity.mjs';

let source = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { source += chunk; });
process.stdin.on('end', () => {
  try {
    if (!source.trim()) throw new TypeError('expected one JSON input object on stdin');
    process.stdout.write(`${JSON.stringify(runSiloxaneZeoliteRigidity(JSON.parse(source)))}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
});
