// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";

// Load all env vars (including non-VITE_ server secrets) into process.env for server routes.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Bundled dev mode serves the client entry through `/@vite/lazy`, which 404s in this
// project's dev server and leaves the app permanently unhydrated (blank pages, dead
// buttons). Disabling it restores normal dev module serving and hydration.
const disableBundledDev = {
  name: "lovable-disable-bundled-dev",
  config() {
    return { experimental: { bundledDev: false } };
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [disableBundledDev],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(process.cwd(), "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(process.cwd(), "node_modules/entities/lib/encode.js"),
        entities: path.resolve(process.cwd(), "node_modules/entities"),
      },
      // One copy of the router and of React, however deep the import chain.
      dedupe: ["@tanstack/react-router", "@tanstack/router-core"],
    },
    optimizeDeps: {
      // The router must be pre-bundled in the same optimizer pass as React. Served as
      // raw source instead, it re-imports "react" at whatever hash the newest pass used,
      // so a tab opened before a mid-session re-optimization ends up with two React
      // copies and a null hook dispatcher: "Cannot read properties of null (reading
      // 'use')" thrown from the router's useAwaited/AwaitInner.
      include: ["@tanstack/react-router", "@tanstack/router-core"],
    },
  },
});
