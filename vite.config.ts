import { defineConfig } from "vite";

import { assetpackPlugin } from "./scripts/assetpack-vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  /**
   * Where the built site is served FROM. Deployed to https://crazy296.github.io/ —
   * a GitHub **user site**, which is served from the domain root, so this is "/".
   *
   * ⚠️ If the game ever moves into a subdirectory — a project repo
   * (crazy296.github.io/spelling-beasts/) or a folder of the user site — this MUST
   * become "/spelling-beasts/" or every asset 404s. It is the one setting that
   * silently breaks a deploy while working perfectly on localhost.
   *
   * Everything that loads a file at runtime already goes through
   * `import.meta.env.BASE_URL` (see src/app/dictionary.ts), so changing it here is
   * the only change needed.
   */
  base: "/",
  plugins: [assetpackPlugin()],
  server: {
    port: 8080,
    open: true,
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
});
