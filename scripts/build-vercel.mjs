#!/usr/bin/env node
/**
 * Post-build adapter: transforms the TanStack Start output (dist/) into the
 * Vercel Build Output API v3 structure (.vercel/output/).
 *
 * dist/client/  → .vercel/output/static/       (CDN-served static files)
 * dist/server/  → .vercel/output/functions/render.func/  (Edge Function)
 *
 * Usage: run after `bun run build:vercel` (handled by the `deploy:vercel` script).
 */

import { cpSync, mkdirSync, rmSync, writeFileSync } from "fs";

const VERCEL_OUT = ".vercel/output";
const FUNC_DIR = `${VERCEL_OUT}/functions/render.func`;

// --- 1. Clean previous output ---
rmSync(VERCEL_OUT, { recursive: true, force: true });

// --- 2. Static assets ---
mkdirSync(`${VERCEL_OUT}/static`, { recursive: true });
cpSync("dist/client", `${VERCEL_OUT}/static`, { recursive: true });
console.log("✓ Static files copied → .vercel/output/static/");

// --- 3. Edge Function ---
mkdirSync(FUNC_DIR, { recursive: true });

// The server entry (dist/server/server.js) dynamically imports
// ./assets/server-*.js — keep the relative path intact by copying both.
cpSync("dist/server/server.js", `${FUNC_DIR}/index.js`);
cpSync("dist/server/assets", `${FUNC_DIR}/assets`, { recursive: true });

// Vercel Edge runtime descriptor
writeFileSync(
  `${FUNC_DIR}/.vc-config.json`,
  JSON.stringify({ runtime: "edge", entrypoint: "index.js" }, null, 2),
);
console.log("✓ Edge function created  → .vercel/output/functions/render.func/");

// --- 4. Routing config ---
// "filesystem" pass lets CDN serve matching static files first.
// The catch-all routes everything else to the Edge SSR function.
const config = {
  version: 3,
  routes: [
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/render" },
  ],
};
writeFileSync(`${VERCEL_OUT}/config.json`, JSON.stringify(config, null, 2));
console.log("✓ Routing config written → .vercel/output/config.json");
console.log("\n🚀 Vercel output ready at .vercel/output/");
