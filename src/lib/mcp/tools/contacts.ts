import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { getContactDetails, searchContacts } from "@/lib/db/contacts";
import { withAudit } from "@/lib/mcp/audit";
import { toolError, toolResult } from "@/lib/mcp/results";

// Letters (any language), spaces, apostrophes, periods, hyphens. Commas and
// parentheses are left out on purpose: they have meaning in the search filter.
const NAME_PATTERN = /^[\p{L}\p{M}' .-]+$/u;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

const searchContactsInput = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(NAME_PATTERN, "Use letters, spaces, apostrophes, periods, or hyphens only.")
    .optional()
    .describe("Part of a first or last name, any case. Every word must match, e.g. 'maya ok'."),
  phone: z
    .string()
    .regex(/^\+?\d{3,15}$/, "Use 3 to 15 digits, with an optional leading +.")
    .optional()
    .describe("Any run of digits from the phone number, e.g. '0112' or '+13125550112'."),
  tag: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .describe("Exact tag name, e.g. 'volunteers'. Returns only contacts with this tag."),
  consent: z
    .enum(["opted_in", "opted_out", "unknown"])
    .optional()
    .describe("Current consent status. 'unknown' means the contact has no consent record."),
  limit: z.number().int().min(1).max(50).default(20).describe("Page size, 1 to 50."),
  cursor: z
    .uuid()
    .optional()
    .describe("The nextCursor value from the previous page. Omit it for the first page."),
});

const getContactInput = z.object({
  contact_id: z.uuid().optional().describe("The contact's id, from search_contacts."),
  phone: z
    .string()
    .regex(E164_PATTERN, "Use E.164 format, e.g. +13125550112.")
    .optional()
    .describe("The full phone number in E.164 format, e.g. +13125550112."),
});

export function registerContactTools(server: McpServer): void {
  server.registerTool(
    "search_contacts",
    {
      title: "Search contacts",
      description:
        "Find contacts by name, phone digits, tag, or consent status. All filters are optional and combine with AND. " +
        "Returns up to `limit` contacts with their tags and consent status, plus nextCursor when there are more. " +
        "To get the next page, call again with the same filters and cursor set to nextCursor. " +
        "Read-only. Use get_contact for one contact's recent messages.",
      inputSchema: searchContactsInput,
      annotations: { readOnlyHint: true },
    },
    withAudit("search_contacts", async (args) => {
      const { contacts, nextCursor } = await searchContacts(getDb(), args);
      const more = nextCursor ? " More are available: pass cursor to get the next page." : "";
      return toolResult(`Found ${contacts.length} contact(s).${more}`, { contacts, nextCursor });
    }),
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get contact",
      description:
        "Get one contact by contact_id or by phone (E.164). Pass exactly one. " +
        "Returns the contact's tags, current consent status (with when and how it was set), and last 10 messages, newest first. " +
        "Check isOptedOut before suggesting any message to this contact. Read-only.",
      inputSchema: getContactInput,
      annotations: { readOnlyHint: true },
    },
    withAudit("get_contact", async ({ contact_id, phone }) => {
      if (contact_id && phone) {
        return toolError("Pass only one of contact_id or phone, not both.");
      }
      const lookup = contact_id ? { id: contact_id } : phone ? { phone } : null;
      if (!lookup) {
        return toolError("Pass contact_id or phone.");
      }

      const contact = await getContactDetails(getDb(), lookup);
      if (!contact) {
        return toolError(
          `No contact found for ${contact_id ? `id ${contact_id}` : phone}. Use search_contacts to look them up.`,
        );
      }

      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "(no name)";
      const consent = contact.isOptedOut
        ? "opted out"
        : (contact.consentStatus ?? "no consent record");
      return toolResult(
        `${name}: ${consent}, ${contact.recentMessages.length} recent message(s).`,
        { contact },
      );
    }),
  );
}
