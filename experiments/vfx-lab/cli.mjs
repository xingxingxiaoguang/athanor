#!/usr/bin/env node
import { execute } from "./lab.mjs";
import { TOOLS } from './definitions.mjs';
import { errorResult } from "./errors.mjs";
import { LabError } from "./errors.mjs";
import { recordFailure } from './journal.mjs';

function parseArguments(input) {
  try { return JSON.parse(input || "{}"); }
  catch (error) { throw recordFailure(process.argv[2] ?? 'unknown', { rawInput: input }, new LabError("INVALID_INPUT", `Invalid argument JSON: ${error.message}`, { path: "arguments", recovery: "Pass a JSON object as the final argument or on stdin. Run help for examples." })); }
}

try {
  const name = process.argv[2] ?? "tools";
  let input = process.argv[3];
  if (input === undefined && !["tools", "help", "--help"].includes(name)) {
    input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 65536) throw new Error("Input exceeds 64 KB");
    }
  }
  const result = name === "--help" || name === "help" ? {
    usage: "node experiments/vfx-lab/cli.mjs <tool-name> '<JSON>' (operations also accept JSON on stdin; tools selectors use the JSON argument, bare tools returns immediately)",
    discovery: { summary: 'tools', one: `tools '{"name":"fx_probe"}'`, all: `tools '{"detail":"full"}'` },
    tools: TOOLS.map(t => t.name),
    examples: [{ tool: "inspect", arguments: { ref: { kind: "tool", id: "catalog" } } }, { tool: "search", arguments: { query: "裂纹" } }, { tool: "render", arguments: { id: "lab/cryo-bloom" } }, { tool: "validate", arguments: { run: "<saved-run>" } }],
  } : await execute(name, parseArguments(input));
  process.stdout.write(JSON.stringify({ ok: true, result }) + "\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: errorResult(error) }) + "\n");
  process.exitCode = 1;
}
