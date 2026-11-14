import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Database tests need a running Supabase stack. They run with `npm run test:db`.
    exclude: [...configDefaults.exclude, "tests/db/**"],
  },
});
