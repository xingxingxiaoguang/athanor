#!/usr/bin/env node
// Regenerate the registry (src/fx/index.js) and the catalog (docs/CATALOG.md) from the effect files.
//
//   node tools/index.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { ROOT, FX_DIR, allIds, loadEffect } from "./lib/fxlib.mjs";
import { registryFiles } from "./lib/registry.mjs";
import { categories } from "../src/fx/categories.js";

const metas = [];
for (const id of allIds()) {
  try {
    const fx = await loadEffect(id);
    metas.push({ id, entry:`src/fx/${id}.js`, status:fx.mod.asset?.status??'library', ...fx.meta });
  } catch (e) { throw new Error(`Cannot index ${id}: ${e.message}`, {cause:e}); }
}
for(const [file,text] of Object.entries(registryFiles(metas,categories))) {
  mkdirSync(dirname(join(ROOT,file)), {recursive:true});
  writeFileSync(join(ROOT,file),text);
}
console.log(`${metas.length} effects -> .cache/athanor/ (generated, ignored)`);
