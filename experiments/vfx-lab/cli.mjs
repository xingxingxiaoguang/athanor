#!/usr/bin/env node
import { execute } from "./lab.mjs";
import { TOOLS } from "./definitions.mjs";

try {
  const name = process.argv[2] ?? "tools";
  let input = process.argv[3];
  if (input === undefined && name !== "tools") {
    input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 65536) throw new Error("Input exceeds 64 KB");
    }
  }
  const result = name === "tools" ? TOOLS : await execute(name, JSON.parse(input || "{}"));
  process.stdout.write(JSON.stringify({ ok: true, result }) + "\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: { code: "TOOL_ERROR", message: error.message, recovery: "Inspect tool schemas with: node experiments/vfx-lab/cli.mjs tools" } }) + "\n");
  process.exitCode = 1;
}
