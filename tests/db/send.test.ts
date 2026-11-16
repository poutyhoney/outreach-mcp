import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/lib/db/client";
import { type ContactSummary, findContact, importContacts } from "@/lib/db/contacts";
import { getMessage } from "@/lib/db/messages";
import type { Messaging } from "@/lib/messaging/config";
import { OPT_OUT_FOOTER } from "@/lib/messaging/guardrails";
import { MockProvider } from "@/lib/messaging/mock-provider";
import { TWILIO_VIRTUAL_PHONE } from "@/lib/messaging/sandbox";
import { refreshMessageStatus, type SendRecipient, sendToContact } from "@/lib/messaging/send";

// A contact made just for this file, so other messages in the database can't
// change whether a send counts as the first one.
const TEST_PHONE = "+13125550185";
const NOON_CHICAGO = new Date("2026-11-16T18:00:00Z");
const THREE_AM_CHICAGO = new Date("2026-11-16T09:00:00Z");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;
let tess: SendRecipient;
let jonah: SendRecipient;
let leo: SendRecipient;

function toRecipient(contact: ContactSummary): SendRecipient {
  return {
    id: contact.id,
    name: contact.firstName ?? "(no name)",
    phone: contact.phone,
    timezone: contact.timezone,
    consentStatus: contact.consentStatus,
  };
}

async function recipientFor(phone: string): Promise<SendRecipient> {
  const contact = await findContact(db, { phone });
  if (!contact) throw new Error(`Contact ${phone} is missing. Run npx supabase db reset.`);
  return toRecipient(contact);
}

// A fresh mock for each test, in sandbox mode like every real run.
function mockMessaging(): { messaging: Messaging; provider: MockProvider } {
  const provider = new MockProvider();
  return { messaging: { provider, from: "+18885550100", sandbox: true }, provider };
}

async function messageCount(contactId: string): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

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
        first_name: "Tess",
        timezone: "America/Chicago",
        consent: "opt_in",
      },
    ],
    { source: "test", dryRun: false },
  );
  tess = await recipientFor(TEST_PHONE);
  jonah = await recipientFor("+13125550112"); // opted out in the seed
  leo = await recipientFor("+16175550125"); // no consent record in the seed
});

// Deleting the contact also deletes its messages and consent (on delete cascade).
afterAll(async () => {
  await db.from("contacts").delete().eq("phone_e164", TEST_PHONE);
});

describe("sendToContact", () => {
  it("sends a first message with the footer, to the Virtual Phone", async () => {
    const { messaging, provider } = mockMessaging();
    const outcome = await sendToContact({ db, messaging, now: NOON_CHICAGO }, tess, "Hi Tess!");

    expect(outcome).toMatchObject({
      status: "sent",
      providerStatus: "queued",
      body: `Hi Tess!\n\n${OPT_OUT_FOOTER}`,
      sandboxRedirectedTo: TWILIO_VIRTUAL_PHONE,
    });
    expect(provider.sent).toEqual([
      { to: TWILIO_VIRTUAL_PHONE, from: "+18885550100", body: `Hi Tess!\n\n${OPT_OUT_FOOTER}` },
    ]);

    if (outcome.status !== "sent") throw new Error("expected a sent outcome");
    const { data: row } = await db
      .from("messages")
      .select("status, provider, provider_message_id, sandbox_redirected_to, direction")
      .eq("id", outcome.messageId)
      .single();
    expect(row).toEqual({
      status: "queued",
      provider: "mock",
      provider_message_id: expect.stringMatching(/^mock-/),
      sandbox_redirected_to: TWILIO_VIRTUAL_PHONE,
      direction: "outbound",
    });
  });

  it("leaves the footer off the second message", async () => {
    const { messaging } = mockMessaging();
    const outcome = await sendToContact({ db, messaging, now: NOON_CHICAGO }, tess, "Hi again.");
    expect(outcome).toMatchObject({ status: "sent", body: "Hi again." });
  });

  it.each([
    ["opted_out", () => jonah, NOON_CHICAGO],
    ["no_consent", () => leo, NOON_CHICAGO],
    ["outside_window", () => tess, THREE_AM_CHICAGO],
  ])("refuses with %s and writes nothing", async (code, recipient, now) => {
    const { messaging, provider } = mockMessaging();
    const before = await messageCount(recipient().id);

    const outcome = await sendToContact({ db, messaging, now }, recipient(), "Hello");

    expect(outcome).toMatchObject({ status: "refused", code });
    expect(provider.sent).toEqual([]);
    expect(await messageCount(recipient().id)).toBe(before);
  });

  it("records a provider failure as a failed message", async () => {
    const { messaging, provider } = mockMessaging();
    provider.failNext(1, "30003");

    const outcome = await sendToContact({ db, messaging, now: NOON_CHICAGO }, tess, "Hello");

    expect(outcome).toMatchObject({ status: "failed", errorCode: "30003" });
    if (outcome.status !== "failed") throw new Error("expected a failed outcome");
    const stored = await getMessage(db, outcome.messageId);
    expect(stored).toMatchObject({ status: "failed", error_code: "30003" });
  });
});

describe("refreshMessageStatus", () => {
  it("saves a newer status from the provider", async () => {
    const { messaging, provider } = mockMessaging();
    const outcome = await sendToContact({ db, messaging, now: NOON_CHICAGO }, tess, "Status?");
    if (outcome.status !== "sent") throw new Error("expected a sent outcome");

    const stored = await getMessage(db, outcome.messageId);
    if (!stored?.provider_message_id) throw new Error("message row is missing");
    provider.setStatus(stored.provider_message_id, { status: "delivered" });

    const { message } = await refreshMessageStatus(db, messaging, stored);
    expect(message.status).toBe("delivered");
    expect(await getMessage(db, outcome.messageId)).toMatchObject({ status: "delivered" });
  });

  it("skips messages from another provider", async () => {
    const { messaging } = mockMessaging();
    const fromTwilio = {
      id: "00000000-0000-4000-8000-000000000000",
      created_at: "",
      contact_id: tess.id,
      direction: "outbound" as const,
      body: "",
      status: "queued",
      error_code: null,
      provider: "twilio",
      provider_message_id: "SM123",
    };
    const { message } = await refreshMessageStatus(db, messaging, fromTwilio);
    expect(message).toBe(fromTwilio);
  });
});
