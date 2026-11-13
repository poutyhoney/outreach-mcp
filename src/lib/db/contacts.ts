import type { Db } from "./client";
import type { Enums, Tables } from "./database.types";

export type Contact = Tables<"contacts">;

export type ConsentStatus = {
  contactId: string;
  status: Enums<"consent_type"> | null;
  channel: Enums<"consent_channel"> | null;
  statusAt: string | null;
  isOptedOut: boolean;
};

export async function findContactByPhone(db: Db, phoneE164: string): Promise<Contact | null> {
  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (error) {
    throw new Error(`findContactByPhone failed: ${error.message}`);
  }
  return data;
}

export async function getConsentStatus(db: Db, contactId: string): Promise<ConsentStatus | null> {
  const { data, error } = await db
    .from("contact_consent_status")
    .select("contact_id, status, channel, status_at, is_opted_out")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (error) {
    throw new Error(`getConsentStatus failed: ${error.message}`);
  }
  if (!data || !data.contact_id) {
    return null;
  }

  return {
    contactId: data.contact_id,
    status: data.status,
    channel: data.channel,
    statusAt: data.status_at,
    isOptedOut: data.is_opted_out ?? false,
  };
}
