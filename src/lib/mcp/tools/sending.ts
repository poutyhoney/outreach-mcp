import type { CallToolResult, McpServer, ServerContext } from "@modelcontextprotocol/server";
import { z } from "zod";
import { type Db, getDb } from "@/lib/db/client";
import { findContact } from "@/lib/db/contacts";
import { SEND_RATE_LIMIT, takeSendQuota } from "@/lib/db/rate-limits";
import { withAudit } from "@/lib/mcp/audit";
import { toolError, toolResult } from "@/lib/mcp/results";
import { contactLookupInput, displayName, parseContactLookup } from "@/lib/mcp/tools/contacts";
import { getMessaging } from "@/lib/messaging/config";
import { sendToContact } from "@/lib/messaging/send";

// Plain strings on purpose. The handler checks contact_id and phone itself, so
// a bad value is refused with a reason AND gets an audit row. A schema error
// would be rejected by the SDK before withAudit runs.
const sendMessageInput = z.object({
  contact_id: z.string().optional().describe("The contact's id, from search_contacts."),
  phone: z
    .string()
    .optional()
    .describe("The contact's phone number in E.164 format, e.g. +13125550101."),
  body: z
    .string()
    .describe(
      "The message text, up to 1,600 characters. The opt-out footer is added to a first message automatically.",
    ),
});

// Every send-tool call takes one slot from the API key's budget, refused ones
// included. Returns a tool error when the budget is used up, or null to go on.
export async function checkSendRateLimit(
  db: Db,
  ctx: ServerContext,
): Promise<CallToolResult | null> {
  const apiKeyId = ctx.http?.authInfo?.clientId;
  if (!apiKeyId) {
    return toolError("Sending needs an API key. Nothing was sent.");
  }

  const quota = await takeSendQuota(db, apiKeyId);
  if (quota.allowed) {
    return null;
  }
  return toolError(
    `Rate limit reached: ${quota.limit} send calls per ${SEND_RATE_LIMIT.windowSeconds} seconds for this API key. ` +
      `Try again after ${quota.resetsAt}. Nothing was sent.`,
  );
}

export function registerSendTools(server: McpServer): void {
  server.registerTool(
    "send_message",
    {
      title: "Send message",
      description:
        "Send one SMS to one contact, by contact_id or phone (E.164). Pass exactly one. " +
        "The server refuses the send, with a reason, when the contact is opted out or has no opt-in, " +
        "their timezone is unknown, it's outside 8:00 to 21:00 their time, or the body is empty or too long. " +
        "Don't retry a refused send unchanged; tell the user the reason. " +
        "Read outreach://compliance-rules first. Returns the message id; check delivery with get_message_status.",
      inputSchema: sendMessageInput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    withAudit("send_message", async (args, ctx) => {
      const db = getDb();
      const limited = await checkSendRateLimit(db, ctx);
      if (limited) {
        return limited;
      }

      const input = contactLookupInput.safeParse({
        contact_id: args.contact_id,
        phone: args.phone,
      });
      if (!input.success) {
        return toolError(`${z.prettifyError(input.error)}\nNothing was sent.`);
      }
      const parsed = parseContactLookup(input.data);
      if ("error" in parsed) {
        return toolError(`${parsed.error} Nothing was sent.`);
      }

      const contact = await findContact(db, parsed.lookup);
      if (!contact) {
        return toolError(
          `No contact found for ${args.contact_id ?? args.phone}. Use search_contacts to look them up. Nothing was sent.`,
        );
      }

      const name = displayName(contact);
      const outcome = await sendToContact(
        { db, messaging: getMessaging(), now: new Date() },
        {
          id: contact.id,
          name,
          phone: contact.phone,
          timezone: contact.timezone,
          consentStatus: contact.consentStatus,
        },
        args.body,
      );

      if (outcome.status === "refused") {
        return toolError(`Not sent (${outcome.code}). ${outcome.reason}`);
      }
      if (outcome.status === "failed") {
        return toolError(
          `The provider rejected the message to ${name} (error ${outcome.errorCode}): ${outcome.reason} ` +
            `It is saved as failed (message ${outcome.messageId}). Tell the user before trying again.`,
        );
      }

      const sandboxNote = outcome.sandboxRedirectedTo
        ? ` Sandbox mode: it went to the Twilio Virtual Phone, not to ${name}.`
        : "";
      return toolResult(
        `Sent to ${name}. Message ${outcome.messageId} is ${outcome.providerStatus}.${sandboxNote} Check delivery with get_message_status.`,
        {
          messageId: outcome.messageId,
          contact: { id: contact.id, name },
          body: outcome.body,
          status: outcome.providerStatus,
          sandboxRedirectedTo: outcome.sandboxRedirectedTo,
        },
      );
    }),
  );
}
