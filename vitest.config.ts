import { defineConfig } from "vitest/config";
import path from "path";

// Note: vitest@4 pulls in vite@8, which is incompatible with both
// @vitejs/plugin-react@6 AND happy-dom@20 here — each throws
// "Cannot read properties of undefined (reading 'config')" on load, which
// broke every suite. All current tests are pure functions (no JSX, no DOM), so
// the React plugin is dropped and the environment is "node". If/when component
// or DOM tests are added, re-add a Vite-8-compatible @vitejs/plugin-react and
// set `environment: "happy-dom"` (per-file via a // @vitest-environment docblock
// is cleanest) once happy-dom is upgraded.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
