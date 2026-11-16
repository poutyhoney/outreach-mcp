import type { Db } from "./client";
import type { Tables, TablesUpdate } from "./database.types";

export type Message = Pick<
  Tables<"messages">,
  | "id"
  | "created_at"
  | "contact_id"
  | "direction"
  | "body"
  | "status"
  | "error_code"
  | "provider"
  | "provider_message_id"
>;

const MESSAGE_COLUMNS =
  "id, created_at, contact_id, direction, body, status, error_code, provider, provider_message_id";

// Statuses that will not change again. Anything else (queued, sending, sent)
// may still move to one of these.
const FINAL_STATUSES = new Set(["delivered", "undelivered", "failed", "received", "canceled"]);

export function isFinalStatus(status: string): boolean {
  return FINAL_STATUSES.has(status);
}

// The newest `limit` messages for a contact, returned oldest first so the
// thread reads top to bottom. hasOlder says whether earlier messages exist.
export async function getConversation(
  db: Db,
  contactId: string,
  limit: number,
): Promise<{ messages: Message[]; hasOlder: boolean }> {
  const { data, error } = await db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (error) {
    throw new Error(`getConversation failed: ${error.message}`);
  }
  return { messages: data.slice(0, limit).reverse(), hasOlder: data.length > limit };
}

export async function getMessage(db: Db, id: string): Promise<Message | null> {
  const { data, error } = await db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`getMessage failed: ${error.message}`);
  }
  return data;
}

// True when the contact has an outbound message that didn't fail. Decides
// whether the next message needs the opt-out footer.
export async function hasBeenMessaged(db: Db, contactId: string): Promise<boolean> {
  const { count, error } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("direction", "outbound")
    .not("status", "in", "(failed,undelivered)");

  if (error) {
    throw new Error(`hasBeenMessaged failed: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export type NewOutboundMessage = {
  contactId: string;
  body: string;
  provider: string;
  sandboxRedirectedTo: string | null;
  broadcastId?: string | null;
};

// Saves an outbound message before it goes to the provider. Its status is
// "pending" until the provider answers. Returns the new message id.
export async function createOutboundMessage(db: Db, input: NewOutboundMessage): Promise<string> {
  const { data, error } = await db
    .from("messages")
    .insert({
      contact_id: input.contactId,
      direction: "outbound",
      body: input.body,
      provider: input.provider,
      status: "pending",
      sandbox_redirected_to: input.sandboxRedirectedTo,
      broadcast_id: input.broadcastId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`createOutboundMessage failed: ${error.message}`);
  }
  return data.id;
}

export type MessageStatusUpdate = {
  status: string;
  providerMessageId?: string;
  errorCode?: string | null;
};

// Leave a field out to keep its stored value.
export async function updateMessageStatus(
  db: Db,
  id: string,
  update: MessageStatusUpdate,
): Promise<void> {
  const row: TablesUpdate<"messages"> = { status: update.status };
  if (update.providerMessageId !== undefined) {
    row.provider_message_id = update.providerMessageId;
  }
  if (update.errorCode !== undefined) {
    row.error_code = update.errorCode;
  }

  const { error } = await db.from("messages").update(row).eq("id", id);
  if (error) {
    throw new Error(`updateMessageStatus failed: ${error.message}`);
  }
}

// The contacts in `contactIds` that already have an outbound message that
// didn't fail. One query for a whole broadcast audience.
export async function messagedContactIds(db: Db, contactIds: string[]): Promise<Set<string>> {
  if (contactIds.length === 0) {
    return new Set();
  }

  const { data, error } = await db
    .from("messages")
    .select("contact_id")
    .in("contact_id", contactIds)
    .eq("direction", "outbound")
    .not("status", "in", "(failed,undelivered)");

  if (error) {
    throw new Error(`messagedContactIds failed: ${error.message}`);
  }
  return new Set(data.map((row) => row.contact_id));
}
