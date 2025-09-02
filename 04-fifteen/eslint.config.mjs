import js from "@eslint/js";

export default [
  { ignores: ["dist/", "node_modules/"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...ESLint.configs.recommended.rules,
      // "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
