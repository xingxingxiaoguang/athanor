export class LabError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    Object.assign(this, details);
  }
}

export function errorResult(error) {
  return {
    code: error.code ?? "TOOL_ERROR", message: error.message,
    recovery: error.recovery ?? "Inspect tool schemas with: node experiments/vfx-lab/cli.mjs tools",
    ...(error.path ? { path: error.path } : {}),
    ...(error.details ? { details: error.details } : {}),
  };
}
