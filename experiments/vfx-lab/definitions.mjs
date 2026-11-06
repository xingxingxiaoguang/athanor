// One contract for the CLI, stdio MCP and the local review UI.
import { LabError } from "./errors.mjs";
import { PROBE_FIELDS } from "./observation.mjs";

const str = (description) => ({ type: "string", description });
const num = (description, minimum, maximum) => ({ type: "number", description, minimum, maximum });
const id = str("Effect ID, e.g. ice/frost-nova, lab/cryo-bloom, or draft/my-effect.");
const run = str("Immutable saved run ID returned by fx_render.");
const options = { type: "object", description: "Effect-specific options; inspect returns actual defaults, not inferred constraints. Art pixels, seconds, radians. palette accepts hex strings; Painter requires Color32. light defaults to 1. x/y/actor are supplied by the lab." };
const schema = (properties, required = [], extra = {}) => ({ type: "object", properties, required, additionalProperties: false, ...extra });
const detail = { type: "string", enum: ["summary", "full"], default: "summary" };
const target = { oneOf: [schema({ id, options }, ["id"]), schema({ run }, ["run"])] };
const selectors = { id, options, run, target };
const selection = { oneOf: [{ required: ["id"], not: { anyOf: [{ required: ["run"] }, { required: ["target"] }] } }, { required: ["run"], not: { anyOf: [{ required: ["id"] }, { required: ["options"] }, { required: ["target"] }] } }, { required: ["target"], not: { anyOf: [{ required: ["id"] }, { required: ["run"] }, { required: ["options"] }] } }] };
const ref = schema({ kind: { type: "string", enum: ["effect", "operator", "run"] }, id: str("Resource ID; operators include core/painter, core/color, core/path, core/field, core/image; search by mechanism to discover all families."), revision: str("Optional expected resource revision; mismatches fail explicitly.") }, ["kind", "id"]);
const list = (items, minItems, maxItems) => ({ type: "array", items, minItems, maxItems });
const resultSchema = (properties, required) => ({ type: "object", properties, required, additionalProperties: true });
const object = { type: "object" }, array = { type: "array", items: object };
const outputs = {
  search: resultSchema({ total: { type: "integer" }, effects: array, recipes: array, resources: array }, ["total", "effects", "recipes", "resources"]),
  inspect: resultSchema({ ref, sections: object, authoringContract: object, capabilities: object }, ["ref"]),
  scaffold: resultSchema({ id, file: str("Absolute editable JavaScript file"), template: str("Actual starting template"), authoringContract: object }, ["id", "file", "template", "authoringContract"]),
  render: resultSchema({ run, target: object, revision: str("Frozen source-and-options identity"), sourceDigest: str("Digest of full saved source/backend closure"), image: str("Absolute contact-sheet path; also returned as MCP image"), manifest: str("Full frame/dependency/runtime manifest path"), frameCount: { type: "integer" }, diagnostics: array, replay: object }, ["run", "target", "revision", "sourceDigest", "image", "manifest", "frameCount", "diagnostics", "replay"]),
  compare: resultSchema({ run, channel: str("Actual saved preview/color/light/combined view"), representation: str("saved-images; current source is never executed"), samples: array, conditions: array, differingConditions: { type: "array", items: { type: "string" } }, image: str("Absolute comparison PNG; also returned as MCP image"), pixelScale: { type: "number" } }, ["run", "channel", "representation", "samples", "conditions", "image", "pixelScale"]),
  probe: resultSchema({ probeRef: str("Saved analysis identity"), targetRun: run, sourceDigest: str("Frozen source identity"), representation: str("saved-images / saved-observations / saved-contact-events / saved-history-polylines / frozen-source-replay"), image: str("Native-pixel view; also returned as MCP image"), samples: array, births: array, sources: array, trails: array, events: array, window: object, units: object, selection: object }, ["probeRef", "targetRun", "sourceDigest", "representation", "image", "samples"]),
  validate: resultSchema({ validationRef: str("Saved analysis identity"), target: object, targetRun: { type: ["string", "null"] }, sourceDigest: str("Actually checked source closure"), passed: { type: "boolean" }, representation: str("current-source-replay or frozen-source-replay"), coverage: object, errors: array, diagnostics: array, unperformed: { type: "array", items: { type: "string" } }, detailRef: str("Saved validation report path") }, ["validationRef", "target", "targetRun", "sourceDigest", "passed", "representation", "coverage", "errors", "diagnostics", "unperformed", "detailRef"]),
  history: resultSchema({ total: { type: "integer" }, runs: array, cursor: { type: "integer" }, nextCursor: { type: ["integer", "null"] }, decision: { type: "null" } }, ["total", "runs", "cursor", "nextCursor", "decision"]),
  export: resultSchema({ run, directory: str("Absolute export directory"), validation: object, files: { type: "array", items: { type: "string" } }, warning: str("Compositing convention") }, ["run", "directory", "validation", "files", "warning"]),
};
const def = (name, description, properties, required = [], extra = {}) => ({ name: `fx_${name}`, description, inputSchema: schema(properties, required, extra), outputSchema: outputs[name] });

export const TOOLS = [
  def("search", "Start here. Find effects, recipes and implemented authoring API contracts. Inspect core/painter or core/color for exact signatures before drawing.", {
    query: str("Words in IDs, descriptions, tags, recipe techniques or SDK contracts. Multiple words use AND within one entry; split compound mechanism queries when needed. English and registered Chinese aliases work."),
    limit: { type: "integer", minimum: 1, maximum: 300, default: 12 },
  }),
  def("inspect", "Read exact authoring contracts, examples, source and actual capabilities. Use ref:{kind:'operator',id:'core/painter'|'core/path'|'core/field'|'core/image'|...} for SDK documentation, ref:{kind:'run',id:run} for saved evidence, or legacy id for effect source. Unsupported internals are declared, not inferred.", {
    id, ref, sections: list({ type: "string", enum: ["overview", "contract", "example", "source", "dependencies", "evidence", "pitfalls", "provenance"] }, 1, 8), detail,
  }, [], { oneOf: [{ required: ["id"], not: { required: ["ref"] } }, { required: ["ref"], not: { required: ["id"] } }] }),
  def("scaffold", "Create an editable draft and brief. Default example preserves the original cryo-bloom start; template:'blank' provides only the module interface. Does not call a model or interpret art direction. Never overwrites a draft.", {
    name: str("New kebab-case draft name, without a path."), brief: str("What it communicates, silhouette, material and timing."),
    question: str("Optional visual question to investigate."), template: { type: "string", enum: ["example", "blank"], default: "example" },
  }, ["name", "brief"]),
  def("render", "Render immutable color/light/combined atlases and event-aware contact sheet. Select a current id or frozen run (also via target); replay never reads current effect files. summary omits frame tables; detail:'full' is for playback clients. LOOK at images before judging. Simulation uses saved 120 Hz backend; library runtime is unchanged.", {
    ...selectors, fps: { type: "integer", enum: [12, 24, 30, 60], default: 30 },
    background: { type: "string", enum: ["ground", "dark", "light", "black", "sky", "none"], default: "ground" },
    events: { type: "object", description: "Named effect times in seconds, merged over exported or saved events.", additionalProperties: num("Effect time in seconds", 0, 12) },
    note: str("Creative hypothesis for this version; recorded without aesthetic approval."), detail,
  }, [], selection),
  def("compare", "Compare 2–4 saved runs at native pixels and common origin. Choose event plus offsets, or alignment:'time' plus absolute times. channel selects preview/color/light/combined without source edits or custom atlas cropping. Reads saved frames only; reports requested/actual time, sampling error, repeated frames, clamping and differing conditions. No aesthetic ranking.", {
    runs: list(run, 2, 4), event: str("Named event shared by every run."),
    offsets: list(num("Seconds relative to event", -12, 12), 1, 24), times: list(num("Absolute effect time in seconds", 0, 12), 1, 24),
    alignment: { type: "string", enum: ["event", "time"], default: "event" },
    channel: { type: "string", enum: ["preview", "color", "light", "combined"], default: "preview" },
  }, ["runs"], { oneOf: [{ required: ["event"], not: { required: ["times"] }, properties: { alignment: { enum: ["event"] } } }, { required: ["alignment", "times"], properties: { alignment: { enum: ["time"] } }, not: { anyOf: [{ required: ["event"] }, { required: ["offsets"] }] } }] }),
  def("validate", "Sample technical contracts for a current id OR frozen run, also via target. Frozen validation replays saved local sources and backend, never current files; unavailable dependencies return REPLAY_UNAVAILABLE. Reports target, representation, coverage and unperformed checks. Passing is not aesthetic approval.", selectors, [], selection),
  def("probe", "Inspect one immutable run without debug edits. Images read saved whole-effect channels; particles/trajectory and sources read actual declarations. trails reads trail.observe sampled history with at/layers/tracks, including breaks, death phase and actual point clocks; no fields/particles. contacts reads immutable contact.observe event tables using window:{from,to}, with solver times, parent/copy IDs, pre/post velocity and response; no at/fields for this view. saved or explicit frozen replay, bounded selection/units; no inferred internals or continuous trajectory.", {
    run, at: { oneOf: [schema({ times: list(num("Effect-local seconds; out-of-range requests report clamping", -12, 24), 1, 24), clock: { type: "string", enum: ["effect"], default: "effect" } }, ["times"]), schema({ event: str("Saved named event"), offsets: list(num("Seconds relative to event", -12, 12), 1, 24), clock: { type: "string", enum: ["effect"], default: "effect" } }, ["event"])] },
    view: { type: "string", enum: ["preview", "color", "light", "combined", "particles", "trajectory", "sources", "contacts", "trails"], default: "color" },
    window: schema({ from: num("Inclusive effect seconds for view:contacts only", -12, 24), to: num("Exclusive effect seconds for view:contacts only", -12, 24) }, ["from", "to"]),
    sampling: { type: "string", enum: ["saved", "replay"], default: "saved" },
    layers: list(str("Declared particle/contact group ID, or source ID for view:sources; never an inferred drawing layer"), 1, 16), particles: list(str("Stable birth/parent ID; unsupported for view:sources"), 1, 64),
    tracks: list(str("Stable declared trail ID for view:trails only; discover IDs in render observations or the first trail probe"), 1, 64),
    fields: list({ type: "string", enum: PROBE_FIELDS }, 1, PROBE_FIELDS.length), limit: { type: "integer", minimum: 1, maximum: 64, default: 12 },
  }, ["run"]),
  def("history", "Find saved run identities, notes, revisions, parents, validation and export evidence. Provide id, run, or query. Lists matching history with pagination; newest does not imply selected/final. detail:'full' includes manifests.", {
    id, run, query: str("Case-insensitive words in ID, name, note or run ID."),
    limit: { type: "integer", minimum: 1, maximum: 60, default: 12 }, cursor: { type: "integer", minimum: 0, default: 0 }, detail,
  }, [], { anyOf: [{ required: ["id"] }, { required: ["run"] }, { required: ["query"] }] }),
  def("export", "Export an explicitly chosen immutable run as Aseprite-style JSON and combined/color/light PNGs. Does not re-render. Optional validationRef must belong to this run. Reports unvalidated status when no validation is supplied. Light uses additive blending; combined alpha is approximate.", {
    run, validationRef: str("Validation analysis ID returned by fx_validate for this exact run."),
  }, ["run"]),
];

export function validateInput(tool, value) {
  const fail = (path, message) => { throw new LabError("INVALID_INPUT", `${path}: ${message}`, { path }); };
  function check(s, v, path) {
    const matches = (sub) => { try { check(sub, v, path); return true; } catch (error) { if (error.code !== "INVALID_INPUT") throw error; return false; } };
    if (s.oneOf && s.oneOf.filter(matches).length !== 1) fail(path, "exactly one supported selector/parameter combination is required; inspect the tool schema");
    if (s.anyOf && !s.anyOf.some(matches)) fail(path, "at least one query scope is required");
    if (s.not && matches(s.not)) fail(path, "conflicting fields");
    const type = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
    if (s.type && (s.type === "integer" ? !Number.isInteger(v) : type !== s.type)) fail(path, `expected ${s.type}`);
    if (typeof v === "number" && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) fail(path, "outside allowed range");
    if (s.enum && !s.enum.includes(v)) fail(path, `expected one of ${s.enum.join(", ")}`);
    if (type === "array") {
      if (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? Infinity)) fail(path, "invalid item count");
      v.forEach((item, i) => check(s.items, item, `${path}[${i}]`));
    }
    if (type === "object") {
      for (const k of s.required ?? []) if (!Object.hasOwn(v, k)) fail(`${path}.${k}`, "required");
      for (const [k, item] of Object.entries(v)) {
        const sub = Object.hasOwn(s.properties ?? {}, k) ? s.properties[k] : undefined;
        if (sub) check(sub, item, `${path}.${k}`);
        else if (s.additionalProperties === false) fail(`${path}.${k}`, "unknown field");
        else if (typeof s.additionalProperties === "object") check(s.additionalProperties, item, `${path}.${k}`);
      }
    }
  }
  check(tool.inputSchema, value, "arguments");
}
