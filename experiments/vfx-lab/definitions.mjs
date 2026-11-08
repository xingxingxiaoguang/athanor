// One contract for the CLI, stdio MCP and the local review UI.
import { LabError } from "./errors.mjs";
import { PROBE_FIELDS } from "./observation.mjs";

const str = (description) => ({ type: "string", description });
const num = (description, minimum, maximum) => ({ type: "number", description, minimum, maximum });
const id = str("Effect ID, e.g. ice/frost-nova, lab/cryo-bloom, or draft/my-effect.");
const run = str("Immutable saved run ID returned by fx_render.");
const options = { type: "object", description: "Effect-specific options; inspect returns actual defaults, not inferred constraints. Art pixels, seconds, radians. palette accepts hex strings; Painter requires Color32. light defaults to 1. x/y/actor/assets are supplied by the lab; declare local PNG resources with the effect's assets export." };
const schema = (properties, required = [], extra = {}) => ({ type: "object", properties, required, additionalProperties: false, ...extra });
const detail = { type: "string", enum: ["summary", "full"], default: "summary" };
const target = { oneOf: [schema({ id, options }, ["id"]), schema({ run }, ["run"])] };
const selectors = { id, options, run, target };
const selection = { oneOf: [{ required: ["id"], not: { anyOf: [{ required: ["run"] }, { required: ["target"] }] } }, { required: ["run"], not: { anyOf: [{ required: ["id"] }, { required: ["options"] }, { required: ["target"] }] } }, { required: ["target"], not: { anyOf: [{ required: ["id"] }, { required: ["run"] }, { required: ["options"] }] } }] };
const ref = schema({ kind: { type: "string", enum: ["effect", "operator", "run", "tool", "mechanism"] }, id: str("Resource ID. tool:catalog lists short summaries; tool:fx_probe returns its exact schema. mechanism:library/* references are discoverable by search and differ from SDK operators core/*."), revision: str("Optional expected resource revision; mismatches fail explicitly.") }, ["kind", "id"]);
const list = (items, minItems, maxItems) => ({ type: "array", items, minItems, maxItems });
const resultSchema = (properties, required) => ({ type: "object", properties: { ...properties, callRef: str('Automatic public-call record ID; retrieve full arguments/result/error with fx_history {callRef}') }, required: [...required, 'callRef'], additionalProperties: true });
const object = { type: "object" }, array = { type: "array", items: object };
const frameWindow = schema({ from: num("Window start; effect seconds, or seconds relative to event when provided", -12, 24), to: num("Inclusive image window end (contact event windows remain half-open)", -12, 24), event: str("Optional saved event for image windows only"), every: { type: "integer", minimum: 1, maximum: 60, default: 1, description: "Image windows only. Explicitly retain every Nth shared saved position; default includes all saved samples. Omitted positions are reported." } }, ['from', 'to']);
const nativeLayout = schema({ columns: { type: 'integer', minimum: 1, maximum: 6 }, maxWidth: { type: 'integer', minimum: 480, maximum: 1600, default: 1120 }, maxHeight: { type: 'integer', minimum: 480, maximum: 1600, default: 1024 } });
const outputs = {
  search: resultSchema({ total: { type: "integer", description: 'Legacy count of matching effects only; totals gives counts per result class before limits.' }, totals: object, effects: array, recipes: array, resources: array, mechanisms: array }, ["total", "effects", "recipes", "resources", "mechanisms"]),
  inspect: resultSchema({ ref, sections: object, authoringContract: object, capabilities: object }, ["ref"]),
  scaffold: resultSchema({ id, file: str("Absolute editable JavaScript file"), template: str("Actual starting template"), authoringContract: object }, ["id", "file", "template", "authoringContract"]),
  render: resultSchema({ run, target: object, revision: str("Frozen source-and-options identity"), sourceDigest: str("Digest of full saved source/backend closure"), image: str("Absolute contact-sheet path; also returned as MCP image"), manifest: str("Full frame/dependency/runtime manifest path"), frameCount: { type: "integer" }, diagnostics: array, replay: object }, ["run", "target", "revision", "sourceDigest", "image", "manifest", "frameCount", "diagnostics", "replay"]),
  compare: resultSchema({ run, channel: str("Actual saved preview/color/light/combined view"), representation: str("saved-images; current source is never executed"), samples: array, conditions: array, differingConditions: { type: "array", items: { type: "string" } }, image: str("Absolute comparison PNG; also returned as MCP image"), pixelScale: { type: "number" } }, ["run", "channel", "representation", "samples", "conditions", "image", "pixelScale"]),
  probe: resultSchema({ probeRef: str("Saved analysis identity"), targetRun: run, sourceDigest: str("Frozen source identity"), representation: str("saved-images / saved-observations / saved-contact-events / saved-history-polylines / frozen-source-replay"), image: str("Native-pixel view; also returned as MCP image"), samples: array, births: array, sources: array, bodies: array, trails: array, events: array, window: object, units: object, selection: object }, ["probeRef", "targetRun", "sourceDigest", "representation", "image", "samples"]),
  validate: resultSchema({ validationRef: str("Saved analysis identity"), target: object, targetRun: { type: ["string", "null"] }, sourceDigest: str("Actually checked source closure"), passed: { type: "boolean" }, representation: str("current-source-replay or frozen-source-replay"), coverage: object, errors: array, diagnostics: array, unperformed: { type: "array", items: { type: "string" } }, detailRef: str("Saved validation report path") }, ["validationRef", "target", "targetRun", "sourceDigest", "passed", "representation", "coverage", "errors", "diagnostics", "unperformed", "detailRef"]),
  history: resultSchema({ total: { type: "integer" }, runs: array, cursor: { type: "integer" }, nextCursor: { type: ["integer", "null"] }, decision: { type: ['object', 'null'] }, calls: object, call: object }, ["total", "runs", "cursor", "nextCursor", "decision"]),
  export: resultSchema({ run, directory: str("Absolute export directory"), validation: object, files: { type: "array", items: { type: "string" } }, warning: str("Compositing convention"), media: array, deliveryRef: str("Media identity, source frame hashes, encoded timestamps and checks; absolute JSON path"), representation: str("saved-images") }, ["run", "directory", "validation", "files", "warning"]),
  library: resultSchema({action:str('planned/installed/rolled-back or current transaction status'),planRef:str('Saved immutable installation plan'),planDigest:str('Exact plan identity'),entries:array,files:array,reusedDependencies:{type:'integer'},frameChannelPairs:{type:'integer'},detailRef:str('Full saved plan path'),transaction:object,conflicts:array},['action','planRef','planDigest','entries','files','frameChannelPairs','detailRef']),
};
for (const name of ['probe', 'compare']) Object.assign(outputs[name].properties, {
  pages: array, layout: object, playback: object,
});
Object.assign(outputs.render.properties, { bounds: object });
Object.assign(outputs.validate.properties, { bounds: object, boundary: object, pages: array, image: str('Optional native boundary raster; no GUI required. Remaining locations are structured in boundary.samples.') });
const def = (name, description, properties, required = [], extra = {}) => ({ name: `fx_${name}`, description, inputSchema: schema(properties, required, extra), outputSchema: outputs[name] });

export const TOOLS = [
  def('library','Register explicitly selected, validated frozen artwork as ordinary library JavaScript. plan stages frozen sources/assets, relocates imports preserving comments, reuses byte-identical library dependencies, compares EVERY saved color/light frame, and previews registry/catalog/category writes without changing the library. install applies only the exact plan and caller-recorded user-approved IDs; stale dependencies/files/selection fail before writes. Partial approval needs a smaller plan. status inspects integrity; recover rolls back an interrupted transaction without overwriting external edits. No aesthetic approval is inferred. See docs/ai-vfx-tools/library-installation.md.',{
    action:{type:'string',enum:['plan','install','status','recover']},
    entries:list(schema({run,validationRef:str('Passing validation for this exact frozen run'),id:str('Formal destination category/name, e.g. weapons/tesla-flight'),metadata:schema({name:str('Approved formal display name'),description:str('Formal description'),tags:list(str('Free artist tags'),0,32)},['name','description'])},['run','validationRef','id','metadata']),1,64),
    categories:list(schema({id:str('New or existing category used by these destinations'),name:str('Category display name'),blurb:str('Category description')},['id','name','blurb']),1,16),
    planRef:str('Exact saved planRef returned by plan'),planDigest:str('Exact planDigest returned by plan'),
    approval:schema({ids:list(str('Exactly the destination IDs approved by the user'),1,64),reason:str('Record the actual user authorization; technical validation/author selection is not user approval')},['ids','reason']),
  },['action'],{oneOf:[{properties:{action:{enum:['plan']}},required:['entries'],not:{anyOf:[{required:['planRef']},{required:['planDigest']},{required:['approval']}]}},{properties:{action:{enum:['install']}},required:['planRef','planDigest','approval'],not:{anyOf:[{required:['entries']},{required:['categories']}]}},{properties:{action:{enum:['status','recover']}},required:['planRef','planDigest'],not:{anyOf:[{required:['entries']},{required:['categories']},{required:['approval']}]}}]}),
  def("search", "Start here. Find effects, recipes, SDK contracts and curated library mechanisms (helpers or reference fragments, not new SDKs). Inspect the returned ref for exact contracts. Painter uses Color32.", {
    query: str("Words in IDs, descriptions, tags, recipe techniques or SDK contracts. Multiple words use AND within one entry; split compound mechanism queries when needed. English whole words/exact IDs and registered Chinese game aliases work; crit aliases critical without matching critters."),
    limit: { type: "integer", minimum: 1, maximum: 300, default: 12 },
  }),
  def("inspect", "Read only what you need: tool for exact schemas; operator core/* for SDK docs; mechanism library/* for helper contracts/source/replaceable inputs (reuse); effect sections:['reuse'] for actual library dependency modules/exports and mechanism links, add source to read those library modules (excludes SDK/runtime); run for saved evidence. Static reachability is not proof of active use.", {
    id, ref, sections: list({ type: "string", enum: ["overview", "contract", "example", "source", "dependencies", "evidence", "pitfalls", "provenance","assets","reuse"] }, 1, 10), detail,
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
  def("compare", "Compare 2–4 frozen runs. Choose event+offsets, absolute times, or window:{from,to,event?,every?}. A window includes shared saved frame positions plus its bounds, with no silent thinning, and returns bounded native PNG pages and a local frame-step/loop playback HTML using those same saved samples. layout:{} also pages explicit times. Reports actual/requested/simulation clocks, gaps, repeats and condition differences; no source evaluation or aesthetic ranking. Public calls are automatically recorded; use history to recover references.", {
    runs: list(run, 2, 4), event: str("Named event shared by every run."),
    offsets: list(num("Seconds relative to event", -12, 12), 1, 24), times: list(num("Absolute effect time in seconds", 0, 12), 1, 24),
    alignment: { type: "string", enum: ["event", "time"], default: "event" },
    channel: { type: "string", enum: ["preview", "color", "light", "combined"], default: "preview" },
    window: frameWindow, layout: nativeLayout,
  }, ["runs"], { oneOf: [{ required: ["event"], not: { anyOf: [{ required: ["times"] }, { required: ['window'] }] }, properties: { alignment: { enum: ["event"] } } }, { required: ["alignment", "times"], properties: { alignment: { enum: ["time"] } }, not: { anyOf: [{ required: ["event"] }, { required: ["offsets"] }, { required: ['window'] }] } }, { required: ['window'], not: { anyOf: [{ required: ['times'] }, { required: ['offsets'] }] } }] }),
  def("validate", "Sample technical contracts for a current id OR frozen run. Inspect core/effect for authoring.bounds asset/viewport declarations. Boundary results give exact sampled time, channel, canvas rectangle, side counts and scan-edge uncertainty, plus native pages for up to three offending samples; AI can act on structured fields without a GUI. boundsTimes adds precise times to normal coverage; boundsMargin expands the finite raster scan. Intentional viewport crop does not disable determinism/clock/ending checks. Frozen replay never substitutes current files. Passing is not aesthetic approval.", { ...selectors,
    boundsTimes: list(num('Additional exact effect times for boundary checks; must be within target duration. These have priority in up to three visualized samples.', 0, 12), 1, 24),
    boundsMargin: { type: 'integer', minimum: 8, maximum: 96, default: 24, description: 'Finite scan gutter around meta.size, in art pixels. Pixels touching scan edges have unknown further extent. 12M sampled frame-pixel budget; no silent reduction.' },
  }, [], selection),
  def("probe", "Inspect a frozen run without debug edits. Image window:{from,to,event?,every?} returns ordered native pages and local step/loop playback; layout:{} also pages at.times/event offsets. It reads saved channels only, never current code. Particle default selection:'active' prioritizes alive objects at the latest requested sample then other sampled times; 'birth-order' or explicit particles keeps inactive IDs available. bodies/sources/trails/contacts use actual declarations, not inferred layers. Contacts retain half-open window:{from,to} without at/event/every. Image gaps and actual clocks are explicit; extra sampling requires explicit frozen child render.", {
    run, at: { oneOf: [schema({ times: list(num("Effect-local seconds; out-of-range requests report clamping", -12, 24), 1, 24), clock: { type: "string", enum: ["effect"], default: "effect" } }, ["times"]), schema({ event: str("Saved named event"), offsets: list(num("Seconds relative to event", -12, 12), 1, 24), clock: { type: "string", enum: ["effect"], default: "effect" } }, ["event"])] },
    view: { type: "string", enum: ["preview", "color", "light", "combined", "particles", "trajectory", "sources", "contacts", "trails", "bodies"], default: "color" },
    window: frameWindow, layout: nativeLayout,
    selection: { type: 'string', enum: ['active', 'birth-order'], default: 'active', description: 'Particles/trajectory only; explicit particles overrides the default. Active mode selects only objects alive in the queried samples, with latest-time priority and round-robin groups within each priority tier; per-group selected/omitted counts are returned.' },
    sampling: { type: "string", enum: ["saved", "replay"], default: "saved" },
    layers: list(str("Declared particle/contact group ID, source ID for view:sources, or program body ID for view:bodies; never an inferred drawing layer"), 1, 16), particles: list(str("Stable birth/parent ID; unsupported for view:sources"), 1, 64),
    tracks: list(str("Stable declared trail ID for view:trails only; discover IDs in render observations or the first trail probe"), 1, 64),
    fields: list({ type: "string", enum: PROBE_FIELDS }, 1, PROBE_FIELDS.length), limit: { type: "integer", minimum: 1, maximum: 64, default: 12 },
  }, ["run"]),
  def("history", "Recover frozen runs, calls and original errors. action:'select' with run/reason records author choice, not approval. action:'bundle' with explicit run copies its artwork history, original calls/errors, image pages, validation/export artifacts into a hashed index and editable report; optional annotations include author judgment, linked discovery references and actually viewed image callRefs (unverified declarations). Does not rerender/revalidate/select. Frozen source closures are excluded. detail:'full' includes manifests.", {
    id, run, query: str("Case-insensitive words in ID, name, note or run ID."),
    limit: { type: "integer", minimum: 1, maximum: 60, default: 12 }, cursor: { type: "integer", minimum: 0, default: 0 }, detail,
    action: { type: 'string', enum: ['list', 'select', 'bundle'], default: 'list' }, reason: str('Required nonempty artistic reason for action:select; at most 2000 characters'),
    annotations: schema({ intent: str('Editable author intent'), changes: list(str('Artistic or structural change'), 0, 32), judgment: str('Author judgment; not automatic approval'), limitations: list(str('Untested scope or remaining burden'), 0, 32), references: list(str('Optional discovery/inspect callRefs to include alongside automatic artwork history'), 0, 64), viewed: list(str('Image callRefs actually observed by the author; unverified author declarations, never inferred from delivery'), 0, 64) }),
    evidence: list(str('Successful public callRef concerning the explicitly selected run'), 0, 24), callRef: str('Retrieve one complete automatic public-call record'),
    includeCalls: { type: 'boolean', default: true }, callCursor: { type: 'integer', minimum: 0, default: 0 }, callLimit: { type: 'integer', minimum: 1, maximum: 60, default: 12 },
  }, [], { anyOf: [{ required: ["id"] }, { required: ["run"] }, { required: ["query"] }, { required: ['callRef'] }] }),
  def("export", "Deliver an explicitly selected saved run. Always includes exact atlas/color/light/combined PNGs, a hashed pack.json and standalone playback/load-node/png modules for consumption outside this checkout; declared source PNGs are preserved too; formats:['mp4','gif'] adds complete animations from saved preview rectangles, without evaluating current files. Inspect an effect/run's delivery for encoder availability (ffmpeg + ffprobe on PATH). scale is integer nearest-neighbor. Default terminal:preserve includes the endpoint sample and its nominal hold; omit-loop explicitly removes the loop endpoint. GIF palette/time quantization and MP4 loss are reported; no playback/aesthetic certification. Optional validationRef must belong to this run; missing validation is reported.", {
    run, validationRef: str("Validation analysis ID returned by fx_validate for this exact run."),
    formats: { ...list({ type: "string", enum: ["atlas", "mp4", "gif"] }, 1, 3), default: ['atlas'] },
    scale: { type: "integer", minimum: 1, maximum: 4, default: 1, description: "Media-only integer nearest-neighbor scale. Exact atlas assets remain native size." },
    terminal: { type: "string", enum: ["preserve", "omit-loop"], default: "preserve", description: "Media-only endpoint policy. Preserve all saved frames by default; omit-loop requires a declared loop. No arbitrary thinning." },
  }, ["run"]),
];

export function validateInput(tool, value) {
  const fail = (path, message) => { throw new LabError("INVALID_INPUT", `${path}: ${message}`, { path,
    recovery: { tool: 'fx_inspect', arguments: { ref: { kind: 'tool', id: tool.name === 'tools' ? 'catalog' : tool.name } }, next: 'Read the exact inputSchema for this call; unknown fields are rejected.' } }); };
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
