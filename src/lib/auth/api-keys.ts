import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/lib/db/client";

// Every key starts with this, so a leaked key is easy to recognize in logs or code.
export const API_KEY_PREFIX = "omcp_";

export type ApiKeyRecord = { id: string; name: string };

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(db: Db, name: string): Promise<{ id: string; key: string }> {
  const key = generateApiKey();
  const { data, error } = await db
    .from("api_keys")
    .insert({ name, key_hash: hashApiKey(key) })
    .select("id")
    .single();

  if (error) {
    throw new Error(`createApiKey failed: ${error.message}`);
  }
  return { id: data.id, key };
}

export async function verifyApiKey(db: Db, key: string): Promise<ApiKeyRecord | null> {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const { data, error } = await db
    .from("api_keys")
    .select("id, name")
    .eq("key_hash", hashApiKey(key))
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`verifyApiKey failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  // Bookkeeping only. A failed update should not block a valid key.
  await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}
