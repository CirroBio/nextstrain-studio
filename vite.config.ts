import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// The app's callback URL is origin + base, so the base is part of its Cirro registration. Local
// development signs in at http://localhost:5173/nextstrain-studio/; a production site with a domain
// of its own sets VITE_BASE=/.
const BASE = process.env.VITE_BASE ?? "/nextstrain-studio/";

export default defineConfig({
  base: BASE,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // The viewer runs in a sandboxed frame with an opaque origin ("null"), and fonts load only with
  // CORS; GitHub Pages answers any origin.
  server: { port: 5173, strictPort: true, host: "localhost", cors: { origin: "null" } },
  preview: { port: 5173, strictPort: true, host: "localhost", cors: { origin: "null" } },
});
