import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

// Serialize expensive renders and use a fresh process for each call: edits to
// transitive imports must be visible, and a bad draft must not kill the viewer.
let pending = Promise.resolve();
export function invoke(name, args = {}) {
  const task = pending.catch(() => {}).then(() => new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [fileURLToPath(new URL("./cli.mjs", import.meta.url)), name], {
      timeout: 90_000, maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      try {
        const result = JSON.parse(stdout);
        if (!result.ok) throw new Error(result.error.message);
        if (error) throw error;
        resolve(result.result);
      } catch (e) { reject(new Error(e.message || stderr || "Tool process failed")); }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(args));
  }));
  pending = task;
  return task;
}
