import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettierRecommended from "eslint-plugin-prettier/recommended"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierRecommended,
  {
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "prettier/prettier": "error",
      semi: ["error", "never"],
      "import/no-named-as-default-member": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-warning-comments": "off",
    },
  },
  // Supabase Edge Functions run on Deno with their own toolchain; the app's
  // Next.js lint/type rules don't apply to them (mirrors the tsconfig exclude).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/**"]),
])

export default eslintConfig
