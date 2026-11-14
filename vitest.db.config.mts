import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Local runs read SUPABASE_URL and the key from .env.local. In CI there is no
// .env.local; the workflow sets the variables, and real env vars always win.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
