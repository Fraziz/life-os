import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-Next assets and standalone Electron scripts:
    "desktop/**",
    "public/vendor/**",
  ]),
  {
    rules: {
      // Keep core hook correctness & immutability strictly enforced; treat React Compiler heuristics
      // and legacy `any` types as warnings while the remaining large route files are refactored.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
