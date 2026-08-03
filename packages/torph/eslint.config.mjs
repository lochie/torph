import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

// Formatting is prettier's job (see .lintstagedrc.cjs) — `prettier` last turns
// off every rule that would fight it.
export default tseslint.config(
  { ignores: ["dist/**"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.cjs", "*.config.ts"],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "after-used", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.tsx"],
    ...react.configs.flat.recommended,
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  {
    files: ["**/*.tsx"],
    ...reactHooks.configs["recommended-latest"],
  },
  prettier,
);
