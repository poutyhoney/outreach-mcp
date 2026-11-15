import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/lib/db/client";
import { findContact } from "@/lib/db/contacts";
import { getConversation, getMessage, isFinalStatus } from "@/lib/db/messages";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;
let mayaId: string;
let messageIds: string[] = [];

// The seed has no messages, so this test adds three for Maya and removes them after.
beforeAll(async () => {
  const url = requireEnv("SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  const maya = await findContact(db, { phone: "+13125550101" });
  if (!maya) throw new Error("Seed contact Maya is missing. Run npx supabase db reset.");
  mayaId = maya.id;

  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
  const { data, error } = await db
    .from("messages")
    .insert([
      {
        contact_id: mayaId,
        direction: "outbound",
        body: "Volunteer night is Thursday.",
        provider: "mock",
        status: "delivered",
        created_at: minutesAgo(30),
      },
      {
        contact_id: mayaId,
        direction: "inbound",
        body: "I'll be there!",
        provider: "mock",
        status: "received",
        created_at: minutesAgo(20),
      },
      {
        contact_id: mayaId,
        direction: "outbound",
        body: "Great, see you then.",
        provider: "mock",
        status: "sent",
        created_at: minutesAgo(10),
      },
    ])
    .select("id");
  if (error) throw new Error(error.message);
  messageIds = data.map((row) => row.id);
});

afterAll(async () => {
  await db.from("messages").delete().in("id", messageIds);
});

describe("getConversation", () => {
  it("returns the newest messages, oldest first", async () => {
    const { messages, hasOlder } = await getConversation(db, mayaId, 50);
    expect(messages.map((m) => m.body)).toEqual([
      "Volunteer night is Thursday.",
      "I'll be there!",
      "Great, see you then.",
    ]);
    expect(hasOlder).toBe(false);
  });

  it("says when older messages were left out", async () => {
    const { messages, hasOlder } = await getConversation(db, mayaId, 2);
    expect(messages.map((m) => m.direction)).toEqual(["inbound", "outbound"]);
    expect(hasOlder).toBe(true);
  });
});

describe("getMessage", () => {
  it("returns the stored status, and null for an unknown id", async () => {
    const latest = await getMessage(db, messageIds[2]);
    expect(latest?.status).toBe("sent");
    expect(await getMessage(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("isFinalStatus", () => {
  it("treats delivered and failed as final, sent as not final", () => {
    expect(isFinalStatus("delivered")).toBe(true);
    expect(isFinalStatus("failed")).toBe(true);
    expect(isFinalStatus("sent")).toBe(false);
  });
});
