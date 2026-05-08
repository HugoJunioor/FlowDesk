import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".claude/**", "data/**", "coverage/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react": react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React-Hooks (rules-of-hooks + exhaustive-deps)
      ...reactHooks.configs.recommended.rules,
      // React (sem JSX scope rule e React import — usamos React 17+ JSX transform)
      ...react.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off", // TS cuida disso
      "react/jsx-uses-react": "off",
      // Acessibilidade — bloqueia erros graves novos, rebaixa legados pra warning
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      // autoFocus eh legitimo em modais/dialogs (ex: foco no input ao abrir).
      // Rebaixar pra warning — codigo novo deve evitar quando possivel.
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/anchor-has-content": "warn",
      // React — entities como ' " > nao quebram nada moderno
      "react/no-unescaped-entities": "warn",
      // React-Refresh
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Rebaixadas pra warning: erros pre-existentes em codigo legado.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  // Configs de build podem usar require() (Tailwind plugins, PostCSS, etc).
  {
    files: ["*.config.{ts,js,cjs,mjs}", "**/*.config.{ts,js,cjs,mjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
