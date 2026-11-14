import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/lib/db/client";
import { getContactDetails, searchContacts } from "@/lib/db/contacts";

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
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
});

// Expected counts come from supabase/seed.sql.
describe("searchContacts", () => {
  it("filters by tag and still returns each contact's other tags", async () => {
    const { contacts } = await searchContacts(db, { tag: "donors", limit: 50 });
    expect(contacts).toHaveLength(9);

    const grace = contacts.find((c) => c.firstName === "Grace");
    expect(grace?.tags).toEqual(["donors", "volunteers"]);
  });

  it("filters by consent status", async () => {
    const optedOut = await searchContacts(db, { consent: "opted_out", limit: 50 });
    expect(optedOut.contacts.map((c) => c.firstName).sort()).toEqual(["Felix", "Jonah"]);

    const unknown = await searchContacts(db, { consent: "unknown", limit: 50 });
    expect(unknown.contacts.map((c) => c.firstName).sort()).toEqual(["Kai", "Leo"]);
  });

  it("matches every word of a name against first or last name", async () => {
    const { contacts } = await searchContacts(db, { name: "maya OKA", limit: 50 });
    expect(contacts.map((c) => c.phone)).toEqual(["+13125550101"]);
  });

  it("matches a run of phone digits", async () => {
    const { contacts } = await searchContacts(db, { phone: "0112", limit: 50 });
    expect(contacts.map((c) => c.firstName)).toEqual(["Jonah"]);
  });

  it("pages through all 25 contacts with no repeats", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const page = await searchContacts(db, { limit: 10, cursor });
      seen.push(...page.contacts.map((c) => c.id));
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });
});

describe("getContactDetails", () => {
  it("finds a contact by phone with consent details", async () => {
    const jonah = await getContactDetails(db, { phone: "+13125550112" });
    expect(jonah?.isOptedOut).toBe(true);
    expect(jonah?.consentChannel).toBe("sms_keyword");
    expect(jonah?.recentMessages).toEqual([]);
  });

  it("returns null for an unknown id", async () => {
    const missing = await getContactDetails(db, { id: "00000000-0000-4000-8000-000000000000" });
    expect(missing).toBeNull();
  });
});
