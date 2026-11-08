import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beginCall, finishCall } from './journal.mjs';

// Serialize expensive renders and use a fresh process for each call: edits to
// transitive imports must be visible, and a bad draft must not kill the viewer.
let pending = Promise.resolve();
export function invoke(name, args = {}) {
  const task = pending.catch(() => {}).then(() => new Promise((resolve, reject) => {
    const callRef = beginCall(name, args);
    // tools has a nonblocking bare-CLI default; pass its small selector explicitly.
    const cliArgs = [fileURLToPath(new URL("./cli.mjs", import.meta.url)), name, ...(name === 'tools' ? [JSON.stringify(args)] : [])];
    const child = execFile(process.execPath, cliArgs, {
      timeout: 90_000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, ATHANOR_PUBLIC_CALL_REF: callRef },
    }, (error, stdout, stderr) => {
      try {
        const result = JSON.parse(stdout);
        if (!result.ok) throw Object.assign(new Error(result.error.message), result.error);
        if (error) throw error;
        resolve(result.result);
      } catch (e) {
        if (error && !stdout.trim()) {
          const diagnostic = { code: error.killed ? 'TOOL_TIMEOUT' : 'TOOL_PROCESS_FAILED', message: error.message || stderr || 'Tool process ended without a result', callRef, recovery: { tool: 'fx_history', arguments: { callRef }, next: 'The interrupted request is recorded. Retry explicitly after checking its arguments and available resources.' } };
          finishCall(callRef, 'interrupted', diagnostic); reject(Object.assign(new Error(diagnostic.message), diagnostic));
        } else reject(Object.assign(new Error(e.message || stderr || "Tool process failed"), { code: e.code, recovery: e.recovery, path: e.path, details: e.details, callRef: e.callRef ?? callRef }));
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(args));
  }));
  pending = task;
  return task;
}
