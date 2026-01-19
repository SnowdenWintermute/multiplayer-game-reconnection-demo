import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // don't try to run tests in dist
    include: ["**/src/**/*.test.ts"],
    // Show full error stack traces
    silent: false,
    // Run tests in full verbose mode
    reporters: "verbose",
  },
});
