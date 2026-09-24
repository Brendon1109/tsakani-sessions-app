// ESLint flat config. `next lint` was removed in Next 16, so `npm run lint` now
// calls the ESLint CLI directly with the same two presets the old
// .eslintrc.json extended: core web vitals and the TypeScript rules.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The analytics collect adapter is copied from upstream and handles
    // untyped beacon payloads, so `any` stays allowed there as before.
    files: ["app/api/e/core.ts", "app/api/e/route.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // React Compiler diagnostics that arrived with eslint-plugin-react-hooks 7
    // inside eslint-config-next 16. The old config never had them and this app
    // does not run the React Compiler. They flag 14 existing spots in client
    // admin pages (a fetch that sets state in an effect, a loader declared
    // below its effect, Date.now in a click handler), none of them a bug
    // today. Warnings keep them visible without turning an upgrade into a
    // refactor. Every other compiler rule stays an error for new code.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  globalIgnores([
    // The defaults of eslint-config-next, restated because this list replaces them.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Served verbatim, and bz.js is copied from the analytics upstream.
    // `next lint` never looked here either.
    "public/**",
    // Generated or local only, never source.
    ".open-next/**",
    ".wrangler/**",
    "dist-dryrun/**",
    "coverage/**",
    "venv/**",
    ".vercel/**",
    ".codex/**",
    ".claude/**",
  ]),
]);
