module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: [
    "server.js",
    "models/**/*.js",
    "routes/**/*.js",
    "middlewares/**/*.js",
    "!node_modules/**"
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  bail: false
};
