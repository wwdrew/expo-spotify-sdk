const universeNative = require("eslint-config-universe/flat/native");
const universeWeb = require("eslint-config-universe/flat/web");

module.exports = [
  ...universeNative,
  ...universeWeb,
  {
    ignores: ["build/**", "plugin/build/**", "node_modules/**"],
  },
];
