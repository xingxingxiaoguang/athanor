#!/usr/bin/env node
// Regenerate the registry (src/fx/index.js) and the catalog (docs/CATALOG.md) from the effect files.
//
//   node tools/index.mjs

import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, FX_DIR, allIds, loadEffect } from "./lib/fxlib.mjs";
import { registryFiles } from "./lib/registry.mjs";
import { categories } from "../src/fx/categories.js";

const metas = [];
for (const id of allIds()) {
  try {
    metas.push({ id, ...(await loadEffect(id)).meta });
  } catch (e) {
    console.error(`skipping ${id}: ${String(e.message ?? e).split("\n")[0]}`);
  }
}
for(const [file,text] of Object.entries(registryFiles(metas,categories,readFileSync(join(ROOT,"README.md"),"utf8")))) writeFileSync(join(ROOT,file),text);
console.log(`${metas.length} effects -> src/fx/index.js, docs/CATALOG.md`);
