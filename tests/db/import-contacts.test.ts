import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/lib/db/client";
import {
  findContact,
  findContactByPhone,
  getConsentStatus,
  importContacts,
} from "@/lib/db/contacts";

// Seeded contacts (see supabase/seed.sql).
const MAYA = "+13125550101";
const JONAH_OPTED_OUT = "+13125550112";

// Contacts this file creates. The seed uses 0101 to 0125, so these are free.
const NEW_A = "+13125550191";
const NEW_B = "+13125550192";
const NEW_C = "+13125550193";
const TEST_PHONES = [NEW_A, NEW_B, NEW_C];
const TEST_TAG = "test-import";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;

// Deleting a contact also deletes its tags links and consent events (on delete cascade).
async function cleanUp() {
  await db.from("contacts").delete().in("phone_e164", TEST_PHONES);
  await db.from("tags").delete().eq("name", TEST_TAG);
}

beforeAll(async () => {
  const url = requireEnv("SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  // In case an earlier run stopped before afterAll.
  await cleanUp();
});

afterAll(cleanUp);

describe("importContacts", () => {
  it("reports without writing on a dry run", async () => {
    const report = await importContacts(
      db,
      [{ phone_e164: NEW_A, first_name: "Dry" }, { phone_e164: MAYA }],
      { source: "test", dryRun: true },
    );

    expect(report).toEqual({ inserted: 1, updated: 1, consentRecorded: 0, optInBlocked: [] });
    expect(await findContactByPhone(db, NEW_A)).toBeNull();
  });

  it("inserts with tags and consent, then updates only the given fields", async () => {
    const first = await importContacts(
      db,
      [
        {
          phone_e164: NEW_A,
          first_name: "Test",
          last_name: "Importer",
          timezone: "America/Chicago",
          custom_fields: { ward: "3" },
          tags: [TEST_TAG],
          consent: "opt_in",
        },
      ],
      { source: "test", dryRun: false },
    );
    expect(first).toEqual({ inserted: 1, updated: 0, consentRecorded: 1, optInBlocked: [] });

    const created = await findContact(db, { phone: NEW_A });
    expect(created?.tags).toEqual([TEST_TAG]);
    expect(created?.consentStatus).toBe("opt_in");
    expect(created?.consentChannel).toBe("import");

    // Second import: a new last name and custom field. Same consent, so no new event.
    const second = await importContacts(
      db,
      [
        {
          phone_e164: NEW_A,
          last_name: "Changed",
          custom_fields: { precinct: "12" },
          consent: "opt_in",
        },
      ],
      { source: "other", dryRun: false },
    );
    expect(second).toEqual({ inserted: 0, updated: 1, consentRecorded: 0, optInBlocked: [] });

    const updated = await findContactByPhone(db, NEW_A);
    expect(updated).toMatchObject({
      first_name: "Test",
      last_name: "Changed",
      timezone: "America/Chicago",
      source: "test",
      custom_fields: { ward: "3", precinct: "12" },
    });
  });

  it("never opts back in a contact who is opted out", async () => {
    // Dry run against a seeded contact who texted STOP.
    const dry = await importContacts(db, [{ phone_e164: JONAH_OPTED_OUT, consent: "opt_in" }], {
      source: "test",
      dryRun: true,
    });
    expect(dry.optInBlocked).toEqual([JONAH_OPTED_OUT]);
    expect(dry.consentRecorded).toBe(0);

    // Real run: an import can opt someone out, but a later import can't undo it.
    await importContacts(db, [{ phone_e164: NEW_B, consent: "opt_out" }], {
      source: "test",
      dryRun: false,
    });
    const report = await importContacts(db, [{ phone_e164: NEW_B, consent: "opt_in" }], {
      source: "test",
      dryRun: false,
    });
    expect(report.optInBlocked).toEqual([NEW_B]);

    const contact = await findContactByPhone(db, NEW_B);
    const consent = await getConsentStatus(db, contact!.id);
    expect(consent?.isOptedOut).toBe(true);
  });

  it("adds a contact with no consent record when the row has no consent", async () => {
    const report = await importContacts(db, [{ phone_e164: NEW_C, first_name: "Quiet" }], {
      source: "test",
      dryRun: false,
    });
    expect(report.consentRecorded).toBe(0);

    const contact = await findContact(db, { phone: NEW_C });
    expect(contact?.consentStatus).toBeNull();
  });
});
