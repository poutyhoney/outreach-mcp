import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey } from "@/lib/auth/api-keys";
import { createDb, type Db } from "@/lib/db/client";
import { takeSendQuota } from "@/lib/db/rate-limits";

// A long window, so the test never straddles two windows.
const TWO_PER_HOUR = { limit: 2, windowSeconds: 3600 };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;
let keyA: string;
let keyB: string;

beforeAll(async () => {
  const url = requireEnv("SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  ({ id: keyA } = await createApiKey(db, "test-rate-limit-a"));
  ({ id: keyB } = await createApiKey(db, "test-rate-limit-b"));
});

// Deleting the keys also deletes their counters (on delete cascade).
afterAll(async () => {
  await db.from("api_keys").delete().in("id", [keyA, keyB]);
});

describe("takeSendQuota", () => {
  it("allows calls up to the limit, then refuses", async () => {
    expect(await takeSendQuota(db, keyA, TWO_PER_HOUR)).toMatchObject({ allowed: true, used: 1 });
    expect(await takeSendQuota(db, keyA, TWO_PER_HOUR)).toMatchObject({ allowed: true, used: 2 });

    const refused = await takeSendQuota(db, keyA, TWO_PER_HOUR);
    expect(refused).toMatchObject({ allowed: false, used: 2, limit: 2 });
    expect(new Date(refused.resetsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("keeps a separate count for each key", async () => {
    expect(await takeSendQuota(db, keyB, TWO_PER_HOUR)).toMatchObject({ allowed: true, used: 1 });
  });
});
