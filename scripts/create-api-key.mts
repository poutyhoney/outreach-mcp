// Usage: npm run key:create -- --name "claude-desktop"
// Prints a new API key once. Only its SHA-256 hash is stored.
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createApiKey } from "../src/lib/auth/api-keys.ts";
import { createDb } from "../src/lib/db/client.ts";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const { values } = parseArgs({ options: { name: { type: "string" } } });
const name = values.name?.trim();
if (!name) {
  console.error('Missing --name. Example: npm run key:create -- --name "claude-desktop"');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  process.exit(1);
}

const { id, key } = await createApiKey(createDb(url, serviceRoleKey), name);

console.log(`Created API key "${name}" (id ${id}) in ${new URL(url).host}`);
console.log("");
console.log(`  ${key}`);
console.log("");
console.log("Copy it now. It is not stored and cannot be shown again.");
