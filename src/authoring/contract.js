export class AuthoringError extends Error {
  constructor(code, path, message, recovery) {
    super(`${path}: ${message}`);
    this.code = code; this.path = path;
    this.recovery = recovery ?? "Inspect the matching core/* authoring API contract for units and supported inputs.";
  }
}
export const fail = (path, message, code = "CONTRACT_MISMATCH", recovery) => { throw new AuthoringError(code, path, message, recovery); };
export function finite(value, path) { if (!Number.isFinite(value)) fail(path, "expected a finite number"); return value; }
export function positive(value, path, zero = false) { finite(value, path); if (zero ? value < 0 : value <= 0) fail(path, `expected ${zero ? 'non-negative' : 'positive'} value`); return value; }
export function count(value, path, max = 10000) { finite(value, path); if (!Number.isInteger(value) || value < 0) fail(path, "expected a non-negative integer"); if (value > max) fail(path, `exceeds explicit budget ${max}`, "BUDGET_EXCEEDED"); return value; }
export function identity(value, path = "id") { if ((typeof value !== "string" || !value.length) && !Number.isInteger(value)) fail(path, "expected a non-empty string or integer"); return value; }
export function point(value, path) { if (!Array.isArray(value) || value.length !== 2) fail(path, "expected [x,y]"); value.forEach((v, i) => finite(v, `${path}[${i}]`)); return value; }
export function choice(value, values, path) { if (!values.includes(value)) fail(path, `expected one of ${values.join(', ')}`); return value; }
export function compatible(a, b, path = "grid") {
  if (a.space !== b.space || a.w !== b.w || a.h !== b.h || a.origin[0] !== b.origin[0] || a.origin[1] !== b.origin[1]) fail(path, "mask grids/spaces differ; explicitly resample or transform before combining");
}
export function color(value, path = "color") {
  if (typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    let s = value.slice(1); if (s.length === 3) s = [...s].map((c) => c + c).join('');
    const n = parseInt(s, 16); return (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >>> 16);
  }
  if (Number.isInteger(value) && value >= -2147483648 && value <= 4294967295) return value;
  fail(path, "expected #rgb, #rrggbb or Color32 integer; CSS names/arrays are unsupported", "CONTRACT_MISMATCH", "Use a hex string, rgb(), hex(), or an entry from fit().");
}
export function alpha(value, path = "alpha") { finite(value, path); if (value < 0 || value > 1) fail(path, "expected coverage in [0,1]; artistic overshoot must be mapped explicitly"); return value; }
export function fingerprint(data) { let h = 2166136261; for (const v of data) { h = Math.imul(h ^ v, 16777619); } return (h >>> 0).toString(16); }
