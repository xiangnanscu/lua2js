/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  env: {
    node: true,
    amd: true,
  },
  rules: {
    "prefer-const": [
      "error",
      {
        destructuring: "all",
        ignoreReadBeforeAssign: false,
      },
    ],
    "vue/no-unused-vars": [
      "warn",
      {
        ignorePattern: "^_",
      },
    ],
    "no-unused-vars": [
      "warn",
      { vars: "all", args: "after-used", argsIgnorePattern: "^_" },
    ],
    "vue/multi-word-component-names": "off",
  },
  extends: [
    // 这里必须以./开头,否则不会被识别为文件路径
    "plugin:vue/vue3-essential",
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    // parserOptions: { tsconfigRootDir: __dirname }
  },
};
