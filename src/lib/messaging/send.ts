// The one path every outbound text takes: guardrails, sandbox routing, a
// messages row, then the provider. send_message calls it now, and
// send_broadcast will call it once per recipient.
import type { Db } from "@/lib/db/client";
import type { Enums } from "@/lib/db/database.types";
import {
  createOutboundMessage,
  hasBeenMessaged,
  isFinalStatus,
  type Message,
  updateMessageStatus,
} from "@/lib/db/messages";
import type { Messaging } from "./config";
import { checkSend, type RefusalCode } from "./guardrails";
import { ProviderError, type SendResult } from "./provider";
import { resolveRecipient } from "./sandbox";

export interface SendDeps {
  db: Db;
  messaging: Messaging;
  now: Date;
}

export interface SendRecipient {
  id: string;
  name: string;
  phone: string;
  timezone: string | null;
  consentStatus: Enums<"consent_type"> | null;
}

export type SendOutcome =
  | {
      status: "sent";
      messageId: string;
      providerStatus: string;
      body: string;
      sandboxRedirectedTo: string | null;
    }
  | { status: "refused"; code: RefusalCode; reason: string }
  | { status: "failed"; messageId: string; errorCode: string; reason: string };

export async function sendToContact(
  { db, messaging, now }: SendDeps,
  recipient: SendRecipient,
  body: string,
  broadcastId: string | null = null,
): Promise<SendOutcome> {
  const isFirstMessage = !(await hasBeenMessaged(db, recipient.id));
  const check = checkSend({ ...recipient, isFirstMessage }, body, now);
  if (!check.ok) {
    return { status: "refused", code: check.code, reason: check.reason };
  }

  const { sendTo, sandboxRedirectedTo } = resolveRecipient(recipient.phone, messaging.sandbox);

  // Save the row first, so there's a record even if the provider call hangs
  // or the server stops halfway.
  const messageId = await createOutboundMessage(db, {
    contactId: recipient.id,
    body: check.body,
    provider: messaging.provider.name,
    sandboxRedirectedTo,
    broadcastId,
  });

  let sent: SendResult;
  try {
    sent = await messaging.provider.send({ to: sendTo, from: messaging.from, body: check.body });
  } catch (error) {
    const errorCode = error instanceof ProviderError ? error.code : "unknown";
    await updateMessageStatus(db, messageId, { status: "failed", errorCode });
    if (!(error instanceof ProviderError)) {
      throw error;
    }
    return { status: "failed", messageId, errorCode, reason: error.message };
  }

  await updateMessageStatus(db, messageId, {
    status: sent.status,
    providerMessageId: sent.providerMessageId,
  });
  return {
    status: "sent",
    messageId,
    providerStatus: sent.status,
    body: check.body,
    sandboxRedirectedTo,
  };
}

// Asks the provider for a newer status while the stored one can still change.
// Skips messages from another provider (sent with the mock, now on Twilio).
export async function refreshMessageStatus(
  db: Db,
  messaging: Messaging,
  message: Message,
): Promise<{ message: Message; refreshError?: string }> {
  const providerMessageId = message.provider_message_id;
  if (
    isFinalStatus(message.status) ||
    !providerMessageId ||
    message.provider !== messaging.provider.name
  ) {
    return { message };
  }

  try {
    const latest = await messaging.provider.getStatus(providerMessageId);
    if (latest.status === message.status) {
      return { message };
    }
    const errorCode = latest.errorCode ?? null;
    await updateMessageStatus(db, message.id, { status: latest.status, errorCode });
    return { message: { ...message, status: latest.status, error_code: errorCode } };
  } catch (error) {
    if (!(error instanceof ProviderError)) {
      throw error;
    }
    return { message, refreshError: error.message };
  }
}
