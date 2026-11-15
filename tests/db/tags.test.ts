import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/lib/db/client";
import { findContact } from "@/lib/db/contacts";
import { addTag, removeTag } from "@/lib/db/tags";

const TEST_TAG = "test-tags";
const NO_SUCH_CONTACT = "00000000-0000-4000-8000-000000000000";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;
let mayaId: string;
let jonahId: string;

async function idFor(phone: string): Promise<string> {
  const contact = await findContact(db, { phone });
  if (!contact) throw new Error(`Seed contact ${phone} is missing. Run npx supabase db reset.`);
  return contact.id;
}

beforeAll(async () => {
  const url = requireEnv("SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  mayaId = await idFor("+13125550101");
  jonahId = await idFor("+13125550112");
  await db.from("tags").delete().eq("name", TEST_TAG);
});

// Deleting the tag also deletes its contact_tags links (on delete cascade),
// so every test starts with no one tagged.
afterEach(async () => {
  await db.from("tags").delete().eq("name", TEST_TAG);
});

describe("addTag", () => {
  it("creates the tag, tags contacts, and skips unknown ids", async () => {
    const result = await addTag(db, [mayaId, jonahId, NO_SUCH_CONTACT], TEST_TAG);
    expect(result).toEqual({ changed: 2, unchanged: 0, notFound: [NO_SUCH_CONTACT] });

    const maya = await findContact(db, { id: mayaId });
    expect(maya?.tags).toEqual(["members", TEST_TAG, "volunteers"]);
  });

  it("counts contacts that already have the tag as unchanged", async () => {
    await addTag(db, [mayaId], TEST_TAG);
    const result = await addTag(db, [mayaId, jonahId], TEST_TAG);
    expect(result).toEqual({ changed: 1, unchanged: 1, notFound: [] });
  });
});

describe("removeTag", () => {
  it("removes the tag only from contacts that had it", async () => {
    await addTag(db, [mayaId], TEST_TAG);
    const result = await removeTag(db, [mayaId, jonahId], TEST_TAG);
    expect(result).toEqual({ changed: 1, unchanged: 1, notFound: [] });

    const maya = await findContact(db, { id: mayaId });
    expect(maya?.tags).toEqual(["members", "volunteers"]);
  });

  it("changes nothing when the tag doesn't exist", async () => {
    const result = await removeTag(db, [mayaId], "test-never-created");
    expect(result).toEqual({ changed: 0, unchanged: 1, notFound: [] });
  });
});
