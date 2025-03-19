import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "build/index.ts",
    "build/esbuild-server.ts",
    "build/esbuild-build.ts",
    "src/travel-stipend-calculator.ts",
    "src/historical-stipend-calculator.ts",
    "src/tests/test-google-flights.ts",
    ".github/empty-string-checker.ts",
    "rename-to-kebab-case.ts",
    "tests/*"
  ],
  project: ["src/**/*.ts"],
  ignore: ["src/types/config.ts", "**/__mocks__/**", "**/__fixtures__/**", "eslint.config.mjs"],
  ignoreExportsUsedInFile: true,
  // eslint can also be safely ignored as per the docs: https://knip.dev/guides/handling-issues#eslint--jest
  ignoreDependencies: ["eslint-config-prettier", "eslint-plugin-prettier", "@types/jest", "@mswjs/data"],
  eslint: true,
};

export default config;
