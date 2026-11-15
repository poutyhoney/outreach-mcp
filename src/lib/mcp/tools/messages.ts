import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { findContact, searchContacts } from "@/lib/db/contacts";
import { getConversation, getMessage, isFinalStatus } from "@/lib/db/messages";
import { withAudit } from "@/lib/mcp/audit";
import { toolError, toolResult } from "@/lib/mcp/results";
import { contactLookupInput, displayName, parseContactLookup } from "@/lib/mcp/tools/contacts";

const getConversationInput = contactLookupInput.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("How many of the most recent messages to return, 1 to 200."),
});

const listOptOutsInput = z.object({
  limit: z.number().int().min(1).max(50).default(20).describe("Page size, 1 to 50."),
  cursor: z
    .uuid()
    .optional()
    .describe("The nextCursor value from the previous page. Omit it for the first page."),
});

const getMessageStatusInput = z.object({
  message_id: z.uuid().describe("The message id, from get_conversation or a send tool."),
});

export function registerMessageTools(server: McpServer): void {
  server.registerTool(
    "get_conversation",
    {
      title: "Get conversation",
      description:
        "Get the message thread with one contact, by contact_id or phone (E.164). Pass exactly one. " +
        "Returns the most recent `limit` messages, oldest first, with direction (inbound or outbound) and delivery status. " +
        "hasOlder is true when earlier messages exist beyond the limit. Read-only.",
      inputSchema: getConversationInput,
      annotations: { readOnlyHint: true },
    },
    withAudit("get_conversation", async (args) => {
      const parsed = parseContactLookup(args);
      if ("error" in parsed) {
        return toolError(parsed.error);
      }

      const db = getDb();
      const contact = await findContact(db, parsed.lookup);
      if (!contact) {
        return toolError(
          `No contact found for ${args.contact_id ?? args.phone}. Use search_contacts to look them up.`,
        );
      }

      const { messages, hasOlder } = await getConversation(db, contact.id, args.limit);
      const older = hasOlder ? " Older messages exist; raise limit to see more." : "";
      return toolResult(`${messages.length} message(s) with ${displayName(contact)}.${older}`, {
        contact: { id: contact.id, name: displayName(contact), phone: contact.phone },
        messages,
        hasOlder,
      });
    }),
  );

  server.registerTool(
    "list_opt_outs",
    {
      title: "List opt-outs",
      description:
        "List contacts who are currently opted out, with when they opted out and how (sms_keyword, import, or manual). " +
        "Never message these contacts; the send tools refuse them. A contact opts back in only by texting START or UNSTOP. " +
        "Paginated: pass nextCursor as cursor to get the next page. Read-only.",
      inputSchema: listOptOutsInput,
      annotations: { readOnlyHint: true },
    },
    withAudit("list_opt_outs", async ({ limit, cursor }) => {
      const { contacts, nextCursor } = await searchContacts(getDb(), {
        consent: "opted_out",
        limit,
        cursor,
      });

      const optOuts = contacts.map((contact) => ({
        id: contact.id,
        name: displayName(contact),
        phone: contact.phone,
        optedOutAt: contact.consentStatusAt,
        channel: contact.consentChannel,
      }));
      const more = nextCursor ? " More are available: pass cursor to get the next page." : "";
      return toolResult(`${optOuts.length} opted-out contact(s).${more}`, { optOuts, nextCursor });
    }),
  );

  server.registerTool(
    "get_message_status",
    {
      title: "Get message status",
      description:
        "Get the delivery status of one message by message_id. " +
        "isFinal is false while the status can still change (queued, sending, sent); check again later. " +
        "errorCode is set when delivery failed. Read-only.",
      inputSchema: getMessageStatusInput,
      annotations: { readOnlyHint: true },
    },
    withAudit("get_message_status", async ({ message_id }) => {
      // TODO(M4): when isFinal is false, ask the provider for a fresh status first.
      const message = await getMessage(getDb(), message_id);
      if (!message) {
        return toolError(
          `No message with id ${message_id}. Use get_conversation to find message ids.`,
        );
      }

      const isFinal = isFinalStatus(message.status);
      return toolResult(
        `Message ${message.id} is ${message.status}${isFinal ? "" : " (not final yet)"}.`,
        {
          messageId: message.id,
          status: message.status,
          isFinal,
          errorCode: message.error_code,
          direction: message.direction,
          provider: message.provider,
          createdAt: message.created_at,
        },
      );
    }),
  );
}
