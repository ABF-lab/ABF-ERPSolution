#!/usr/bin/env node
/**
 * Patch every .vc-config.json in .vercel/output/functions/ to use nodejs20.x.
 *
 * Why this exists:
 *   @astrojs/vercel@7.x has a long-standing bug where it writes "nodejs18.x"
 *   into the function config even when the build runs on Node 20+. Vercel
 *   then rejects the deployment with:
 *     "The following Serverless Functions contain an invalid 'runtime':
 *      _render (nodejs18.x)"
 *   because nodejs18.x is no longer accepted.
 *
 * Run automatically by `npm run build` (see package.json).
 */
import fs from "node:fs";
import path from "node:path";

const FUNCTIONS_DIR = ".vercel/output/functions";
const TARGET_RUNTIME = "nodejs20.x";

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const matches = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) matches.push(...walk(full));
    else if (e.name === ".vc-config.json") matches.push(full);
  }
  return matches;
}

const configs = walk(FUNCTIONS_DIR);
if (configs.length === 0) {
  console.log(`[patch-vercel-runtime] no .vc-config.json found in ${FUNCTIONS_DIR} — skipping`);
  process.exit(0);
}

let patched = 0;
for (const file of configs) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (json.runtime && json.runtime !== TARGET_RUNTIME) {
    const before = json.runtime;
    json.runtime = TARGET_RUNTIME;
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
    console.log(`[patch-vercel-runtime] ${file}: ${before} → ${TARGET_RUNTIME}`);
    patched++;
  }
}
console.log(`[patch-vercel-runtime] done — patched ${patched}/${configs.length} configs`);
