#!/usr/bin/env node
import { execute } from "./lab.mjs";
import { TOOLS } from "./definitions.mjs";
import { errorResult } from "./errors.mjs";
import { LabError } from "./errors.mjs";

function parseArguments(input) {
  try { return JSON.parse(input || "{}"); }
  catch (error) { throw new LabError("INVALID_INPUT", `Invalid argument JSON: ${error.message}`, { path: "arguments", recovery: "Pass a JSON object as the final argument or on stdin. Run help for examples." }); }
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
  const result = name === "tools" ? TOOLS : name === "--help" || name === "help" ? {
    usage: "node experiments/vfx-lab/cli.mjs <tool-name> '<JSON>' (or JSON on stdin)",
    examples: [{ tool: "inspect", arguments: { ref: { kind: "operator", id: "core/painter" } } }, { tool: "render", arguments: { id: "lab/cryo-bloom" } }, { tool: "validate", arguments: { run: "<saved-run>" } }], tools: TOOLS.map((t) => t.name),
  } : await execute(name, parseArguments(input));
  process.stdout.write(JSON.stringify({ ok: true, result }) + "\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: errorResult(error) }) + "\n");
  process.exitCode = 1;
}
