import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBroadcast,
  createConfirmToken,
  getTagAudience,
  hashConfirmToken,
} from "@/lib/db/broadcasts";
import { createDb, type Db } from "@/lib/db/client";
import { findContact, importContacts } from "@/lib/db/contacts";
import { messagedContactIds } from "@/lib/db/messages";

const TEST_TAG = "test-broadcast";
const TEST_PHONE = "+13125550186";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;
let testContactId: string;
const broadcastIds: string[] = [];

beforeAll(async () => {
  const url = requireEnv("SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  await db.from("contacts").delete().eq("phone_e164", TEST_PHONE);
  await importContacts(
    db,
    [
      {
        phone_e164: TEST_PHONE,
        first_name: "Bea",
        timezone: "America/Chicago",
        custom_fields: { ward: "3" },
        tags: [TEST_TAG],
        consent: "opt_in",
      },
    ],
    { source: "test", dryRun: false },
  );
  const contact = await findContact(db, { phone: TEST_PHONE });
  if (!contact) throw new Error("Test contact was not created.");
  testContactId = contact.id;
});

// Deleting the contact also deletes its tag links and messages (on delete cascade).
afterAll(async () => {
  await db.from("broadcasts").delete().in("id", broadcastIds);
  await db.from("contacts").delete().eq("phone_e164", TEST_PHONE);
  await db.from("tags").delete().eq("name", TEST_TAG);
});

describe("getTagAudience", () => {
  it("returns everyone with the tag, with custom fields and consent", async () => {
    expect(await getTagAudience(db, TEST_TAG)).toEqual([
      {
        id: testContactId,
        firstName: "Bea",
        lastName: null,
        phone: TEST_PHONE,
        timezone: "America/Chicago",
        consentStatus: "opt_in",
        customFields: { ward: "3" },
      },
    ]);
  });

  it("returns the seeded volunteers", async () => {
    const audience = await getTagAudience(db, "volunteers");
    expect(audience).toHaveLength(11);
    expect(audience?.map((member) => member.phone)).toContain("+13125550101");
  });

  it("returns an empty list for an unknown tag", async () => {
    expect(await getTagAudience(db, "no-such-tag")).toEqual([]);
  });
});

describe("messagedContactIds", () => {
  it("finds contacts with a message that didn't fail", async () => {
    expect(await messagedContactIds(db, [testContactId])).toEqual(new Set());

    await db.from("messages").insert({
      contact_id: testContactId,
      direction: "outbound",
      body: "Hello",
      provider: "mock",
      status: "failed",
    });
    expect(await messagedContactIds(db, [testContactId])).toEqual(new Set());

    await db.from("messages").insert({
      contact_id: testContactId,
      direction: "outbound",
      body: "Hello again",
      provider: "mock",
      status: "delivered",
    });
    expect(await messagedContactIds(db, [testContactId])).toEqual(new Set([testContactId]));
  });
});

describe("createBroadcast", () => {
  it("stores the token's hash, never the token", async () => {
    const { token, hash } = createConfirmToken();
    const { id } = await createBroadcast(db, {
      name: "Test",
      bodyTemplate: "Hi {{first_name}}",
      tag: TEST_TAG,
      previewCount: 1,
      confirmTokenHash: hash,
      audienceHash: "abc",
    });
    broadcastIds.push(id);

    const { data } = await db
      .from("broadcasts")
      .select("status, confirm_token_hash, audience_hash")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      status: "previewed",
      confirm_token_hash: hashConfirmToken(token),
      audience_hash: "abc",
    });
    expect(data?.confirm_token_hash).not.toContain(token);
  });
});
