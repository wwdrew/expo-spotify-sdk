/** @type {import('jest').Config} */
module.exports = {
  watchman: false,
  projects: [
    "<rootDir>/plugin/jest.config.js",
    {
      ...require("expo-module-scripts/jest-preset-cli"),
      displayName: "src",
      testRegex: undefined,
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
    },
  ],
};
