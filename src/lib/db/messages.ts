import type { Db } from "./client";
import type { Tables } from "./database.types";

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
