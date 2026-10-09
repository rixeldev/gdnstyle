import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    extends: ["eslint:recommended", "plugin:prettier/recommended"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      semi: ["error", "never"],
      "prettier/prettier": "error",
      "import/no-named-as-default-member": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-warning-comments": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])

export default eslintConfig
