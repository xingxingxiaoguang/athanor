# Repository instructions

<!-- CODEGRAPH_START -->
## CodeGraph

If `.codegraph/` exists at the repository root, use CodeGraph before text search or reading code to locate/understand implementation: `codegraph explore "<symbols or question>"`, or the `codegraph_explore` MCP tool. If absent, skip CodeGraph; do not index automatically.
<!-- CODEGRAPH_END -->

## Two implementation foundations

The workbench grows from both the existing 200+ effects **and their code implementations**, and the low-level mechanisms of https://tsnm-spine-particle.com/. The effect library is an algorithm/implementation source, not merely a visual reference or a list of needs. Before adding a general creation capability, inspect relevant effects, category helpers and core code; record the concrete implementation paths being extracted, retained or generalized. Cross-check the reference platform's underlying emission, motion, texture, lifetime and other useful mechanisms without recreating its human-facing editor. Preserve attribution on adapted code. Prefer lifting mature behavior into composable, observable operators to either copying a whole preset or independently reinventing existing algorithms.

## Source and generated-output boundary (2026-11-09)

The user's cleanup instruction supersedes earlier retention of bulky tracked evaluations, production revisions and deliveries. Canonical reusable artwork lives in `src/fx/`; preserve required source dependencies, original textures and attribution. The only demo source is `demo/`. Registries, images, exports, build outputs, draft revisions and raw evaluation evidence stay ignored. Commit only compact original evaluation reports, build identity summaries and reproduction instructions; keep raw calls/errors/artwork versions/images under ignored `records/vfx-lab/creator-evaluations/`. Run `npm run assets:check` before committing. See [asset organization](docs/ASSETS.md).

Run `npm ci` to install the local pre-commit/pre-push guards; do not disable them to push generated outputs. `npm run repo:check:staged` checks actual staged bytes, and `npm run repo:check` checks history after the cleaned baseline, including merged side branches. Keep the source/resource/evaluation/history budgets in `.repository-policy.json`; never raise them merely to admit exports. Only `demo/index.html` may be a standalone HTML entry. See [repository guards](docs/REPOSITORY-GUARDS.md). These maintenance-only guards do not change creator/render contracts; verify them with `npm run repo:test` using real isolated Git operations.

## Independent creator gate for the VFX workbench

The primary creator is an AI agent. Assess public-contract discovery, structured inputs/results, diagnostic clarity, editing/recovery steps and avoidable code infrastructure from the AI caller's actual use. A convenient human GUI is not the usability target or a required gate; original-scale images remain necessary visual evidence and may be consumed directly through image tools.

The user requires an independent creator exercise after **each completed substantive functional loop or grouped wave**, not only unit tests or a developer-authored demo. Their 2026-11-07 refinement permits small, deterministic improvements to be grouped efficiently; do not run a separate creator for every tiny fix. Exercise the combined wave when contract/behavior changes or uncertain creative-use consequences warrant actual observation. This applies to SDK algorithms, reusable mechanisms and workflow/observation features.

- Spawn a fresh independent subagent without implementation conversation context (`fork_turns: "none"`), working on an isolated snapshot with recorded build hashes. Give it a complex original effect task related to the delivered capability; ordinary JavaScript editing is part of the product contract.
- The creator must not read tool/runtime/SDK implementation, implementation tests, frozen `sources.json`, other creators' solutions or developer explanations. It may read public tool definitions by calling `tools`, API docs, examples and reference effect source through public inspect, and edit its own work. Operator inspect must not request implementation source.
- Require actual observation of original-scale images, at least two meaningful local modifications, comparison, technical validation and export of the explicitly selected same frozen run. Exercise history/replay when relevant. Keep public calls, original errors, artwork versions, images and the candid report.
- Assess (1) creative freedom and concrete assistance; (2) ergonomics and avoidable hand-written infrastructure the tool should supply; (3) ability enabled by guidance and mechanism reuse that was difficult before. Distinguish artistic choices from repeated engineering. Do not infer net time savings, artistic superiority or a capability leap without suitable comparative evidence.
- Preserve the original report and build identity. Fix confirmed issues and have the independent creator retest via public calls; add a separate retest record. Do not silently rewrite the original outcome after a fix. A repaired issue can use the same independent tester; a new feature loop needs a fresh creator.
- Archive reproducible lightweight evidence under `experiments/vfx-lab/evaluations/`, with bulky raw runs under ignored `records/vfx-lab/creator-evaluations/`. Clearly separate technical verification, creator assessment and untested product ambitions.

Documentation entry: [AI VFX workbench](docs/ai-vfx-tools/README.md). Development handoff: [HANDOFF](docs/ai-vfx-tools/HANDOFF.md) (for the next developer, not reading material for black-box creators). Black-box creators start with the [public creator guide](experiments/vfx-lab/README.md).

See `docs/ai-vfx-tools/creator-evaluation.md` for the evidence rubric and current evaluations. Do not introduce a GUI-only criterion, fixed artwork DSL, automatic aesthetic rating or forced preset as an interpretation of these requirements.
