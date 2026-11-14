import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/lib/db/client";
import { findContactByPhone, getConsentStatus } from "@/lib/db/contacts";

// Seeded contacts (see supabase/seed.sql).
const JONAH_OPTED_OUT = "+13125550112";
const MAYA_OPTED_IN = "+13125550101";
const KAI_NO_EVENTS = "+18085550124";
const NOT_IN_DB = "+19995550199";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;

beforeAll(() => {
  const url = requireEnv("SUPABASE_URL");
  // These tests assume seed data. Never run them against the hosted project.
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
});

async function consentFor(phone: string) {
  const contact = await findContactByPhone(db, phone);
  expect(contact, `seeded contact ${phone}`).not.toBeNull();
  return getConsentStatus(db, contact!.id);
}

describe("seed data", () => {
  it("has 25 contacts", async () => {
    const { count, error } = await db.from("contacts").select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(25);
  });
});

describe("consent status", () => {
  it("reports an opted-out contact as opted out (latest event wins)", async () => {
    const status = await consentFor(JONAH_OPTED_OUT);
    expect(status).toMatchObject({
      status: "opt_out",
      channel: "sms_keyword",
      isOptedOut: true,
    });
  });

  it("reports an opted-in contact as not opted out", async () => {
    const status = await consentFor(MAYA_OPTED_IN);
    expect(status).toMatchObject({ status: "opt_in", isOptedOut: false });
  });

  it("returns a null status for a contact with no consent events", async () => {
    const status = await consentFor(KAI_NO_EVENTS);
    expect(status).toMatchObject({ status: null, channel: null, isOptedOut: false });
  });

  it("returns null for a phone number that is not in the database", async () => {
    expect(await findContactByPhone(db, NOT_IN_DB)).toBeNull();
  });
});
