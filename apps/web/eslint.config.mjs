import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: configDir });

const eslintConfig = [
  {
    ignores: [".next/**", ".next-dev/**", "next-env.d.ts", "node_modules/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
