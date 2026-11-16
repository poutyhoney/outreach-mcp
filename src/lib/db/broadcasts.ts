import { createHash, randomBytes } from "node:crypto";
import type { AudienceMember } from "@/lib/messaging/broadcast";
import type { Db } from "./client";

// A tag bigger than this is refused. The cap keeps the "already messaged"
// lookup to one request (supabase-js puts .in() ids in the URL).
export const MAX_AUDIENCE_SIZE = 100;

// How long a preview's confirm_token stays valid.
export const CONFIRM_TOKEN_TTL_MINUTES = 15;

// Everyone with the tag, with what planBroadcast needs. Returns null when the
// tag has more than MAX_AUDIENCE_SIZE contacts.
export async function getTagAudience(db: Db, tag: string): Promise<AudienceMember[] | null> {
  const { data, error } = await db
    .from("contacts_with_consent")
    .select(
      "id, first_name, last_name, phone_e164, timezone, consent_status, custom_fields, contact_tags!inner(tags!inner(name))",
    )
    .eq("contact_tags.tags.name", tag)
    .order("id")
    .limit(MAX_AUDIENCE_SIZE + 1);

  if (error) {
    throw new Error(`getTagAudience failed: ${error.message}`);
  }
  if (data.length > MAX_AUDIENCE_SIZE) {
    return null;
  }

  // View columns are nullable in the generated types, hence the fallbacks.
  return data.map((row) => ({
    id: row.id ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone_e164 ?? "",
    timezone: row.timezone,
    consentStatus: row.consent_status,
    customFields: (row.custom_fields ?? {}) as Record<string, string>,
  }));
}

// The token goes to the model once. Only its hash is stored, like API keys.
export function createConfirmToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashConfirmToken(token) };
}

export function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type NewBroadcast = {
  name: string;
  bodyTemplate: string;
  tag: string;
  previewCount: number;
  confirmTokenHash: string;
  audienceHash: string;
};

export async function createBroadcast(
  db: Db,
  input: NewBroadcast,
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await db
    .from("broadcasts")
    .insert({
      name: input.name,
      body_template: input.bodyTemplate,
      tag_filter: input.tag,
      status: "previewed",
      preview_count: input.previewCount,
      confirm_token_hash: input.confirmTokenHash,
      audience_hash: input.audienceHash,
    })
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(`createBroadcast failed: ${error.message}`);
  }
  return { id: data.id, createdAt: data.created_at };
}
