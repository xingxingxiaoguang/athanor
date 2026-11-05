// One contract for the CLI, stdio MCP and the local review UI.
const str = (description) => ({ type: "string", description });
const num = (description, minimum, maximum) => ({ type: "number", description, minimum, maximum });
const id = str("Effect ID, e.g. ice/frost-nova, lab/cryo-bloom, or draft/my-effect.");
const options = { type: "object", description: "Effect-specific options. seed, palette and light are supported. Coordinates use art pixels; time uses seconds." };
const schema = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const def = (name, description, properties, required = []) => ({ name: `fx_${name}`, description, inputSchema: schema(properties, required) });

export const TOOLS = [
  def("search", "Start here. Find existing effects or reusable techniques before writing code. Returns IDs and recipe references; then inspect the closest candidates.", {
    query: str("Words in IDs, descriptions, tags or recipe techniques. English and recipe Chinese aliases work."),
    limit: { type: "integer", minimum: 1, maximum: 300, default: 12 },
  }),
  def("inspect", "Read a reference's source, metadata and relevant recipes. Borrow mechanisms and explain your art decisions; a reference is not a finished design.", { id }, ["id"]),
  def("scaffold", "Create an editable draft from the cryo-bloom example, recording an art brief and a question to investigate. Does not call a model or invent art direction. Existing drafts are never overwritten.", {
    name: str("New kebab-case draft name, without a path."), brief: str("What it communicates, silhouette, material and timing."),
    question: str("One visual question this draft should answer."),
  }, ["name", "brief", "question"]),
  def("render", "Render a version into immutable color/light/combined atlases, event-aware contact sheet and replay manifest. Inspect images before judging. Uses the experimental 120 Hz simulation clock; does not alter library runtime.", {
    id, options, fps: { type: "integer", enum: [12, 24, 30, 60], default: 30 },
    background: { type: "string", enum: ["ground", "dark", "light", "black", "sky", "none"], default: "ground" },
    events: { type: "object", description: "Named event times in seconds, merged over exported events. Supply release/contact for references without them.", additionalProperties: num("Effect time in seconds", 0, 12) },
    note: str("Creative hypothesis for this version; recorded for comparison."),
  }, ["id"]),
  def("compare", "Compare saved runs at native pixel scale and a common origin, aligned to a named event. Returns visual evidence, not an aesthetic score. Missing events are errors rather than guessed alignment.", {
    runs: { type: "array", items: str("Saved run ID"), minItems: 2, maxItems: 4 },
    event: str("Named event shared by every run, e.g. release."),
  }, ["runs", "event"]),
  def("validate", "Check sampled bounds, empty one-shot endings, color AND light reproducibility, loop periodicity and cross-FPS clock behavior. Reports coverage and separates errors from diagnostics; passing does not certify aesthetics or every possible frame.", { id, options }, ["id"]),
  def("export", "Export a previously rendered, immutable run as Aseprite-style JSON plus combined/color/light PNGs. Does not re-render current source. Separate light is intended for additive blending; combined alpha is a convenience approximation.", { run: str("Saved run ID") }, ["run"]),
];

export function validateInput(tool, value) {
  function check(s, v, path) {
    const type = Array.isArray(v) ? "array" : v === null ? "null" : typeof v;
    if (s.type && (s.type === "integer" ? !Number.isInteger(v) : type !== s.type)) throw new Error(`${path}: expected ${s.type}`);
    if (typeof v === "number" && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) throw new Error(`${path}: outside allowed range`);
    if (s.enum && !s.enum.includes(v)) throw new Error(`${path}: expected one of ${s.enum.join(", ")}`);
    if (type === "array") {
      if (v.length < (s.minItems ?? 0) || v.length > (s.maxItems ?? Infinity)) throw new Error(`${path}: invalid item count`);
      v.forEach((item, i) => check(s.items, item, `${path}[${i}]`));
    }
    if (type === "object") {
      for (const k of s.required ?? []) if (!(k in v)) throw new Error(`${path}.${k}: required`);
      for (const [k, item] of Object.entries(v)) {
        const sub = Object.hasOwn(s.properties ?? {}, k) ? s.properties[k] : undefined;
        if (sub) check(sub, item, `${path}.${k}`);
        else if (s.additionalProperties === false) throw new Error(`${path}.${k}: unknown field`);
        else if (typeof s.additionalProperties === "object") check(s.additionalProperties, item, `${path}.${k}`);
      }
    }
  }
  check(tool.inputSchema, value, "arguments");
}
