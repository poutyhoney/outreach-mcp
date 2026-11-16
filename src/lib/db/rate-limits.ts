import type { Db } from "./client";

// send_message and send_broadcast share one budget per API key: at most
// `limit` calls in each window of `windowSeconds`.
export const SEND_RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export type SendQuota = {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAt: string;
};

// Takes one call from the key's budget. When allowed is false, nothing was
// counted and the caller must refuse the send.
export async function takeSendQuota(
  db: Db,
  apiKeyId: string,
  { limit, windowSeconds } = SEND_RATE_LIMIT,
): Promise<SendQuota> {
  const { data, error } = await db
    .rpc("take_send_quota", {
      p_api_key_id: apiKeyId,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    .single();

  if (error) {
    throw new Error(`takeSendQuota failed: ${error.message}`);
  }
  return { allowed: data.allowed, used: data.used, limit, resetsAt: data.resets_at };
}
