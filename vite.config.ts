import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Cloudflare Workers runtime in dev is slow and can hang locally (WebSocket gaps).
// Local Supabase development uses the standard Vite dev server on :5173.
// Use `pnpm run dev:cf` when you need the Workers runtime locally.
//
// Set DEPLOY_TARGET=vercel to opt out of the Cloudflare plugin (used by build:vercel).
const isVercelBuild = process.env.DEPLOY_TARGET === "vercel";
const useCloudflare =
  !isVercelBuild &&
  (process.env.CF_WORKERS === "1" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_event === "preview");

export default defineConfig({
  base: process.env.ELECTRON === "true" ? "./" : "/",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
  plugins: [
    ...(useCloudflare ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    tanstackStart({
      server: { entry: "server" },
    }),
    ...(isVercelBuild ? [nitro()] : []),
    viteReact(),
    tailwindcss(),
    tsConfigPaths(),
  ],
});
