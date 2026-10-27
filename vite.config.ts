import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import pkg from "./package.json";

// The app's callback URL is origin + base, so the base is part of its Cirro registration. Local
// development signs in at http://localhost:5173/nextstrain-studio/; a production site with a domain
// of its own sets VITE_BASE=/.
const BASE = process.env.VITE_BASE ?? "/nextstrain-studio/";

// The commit the pipelines' code is read from when the app registers them in a project
// (src/cirro/pipelines.ts). It must be pushed to GitHub before Cirro can run it.
const PIPELINE_VERSION = process.env.GITHUB_SHA ?? execSync("git rev-parse HEAD").toString().trim();

export default defineConfig({
  base: BASE,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __PIPELINE_VERSION__: JSON.stringify(PIPELINE_VERSION) },
  // The viewer runs in a sandboxed frame with an opaque origin ("null"), and fonts load only with
  // CORS; GitHub Pages answers any origin.
  server: { port: 5173, strictPort: true, host: "localhost", cors: { origin: "null" } },
  preview: { port: 5173, strictPort: true, host: "localhost", cors: { origin: "null" } },
});
