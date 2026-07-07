import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.service.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@mingle/shared$": "<rootDir>/../../../packages/shared/src/index",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // expo-server-sdk is ESM-only; use a hand-crafted CJS-compatible mock in tests.
    "^expo-server-sdk$": "<rootDir>/__mocks__/expo-server-sdk",
  },
};

export default config;
