import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { normalizePhone, normalizeTag, normalizeTimezone } from "@/lib/contacts/validate";
import { getDb } from "@/lib/db/client";
import { findContact, importContacts } from "@/lib/db/contacts";
import { addTag, removeTag } from "@/lib/db/tags";
import { withAudit } from "@/lib/mcp/audit";
import { toolError, toolResult } from "@/lib/mcp/results";
import { displayName } from "@/lib/mcp/tools/contacts";

const CUSTOM_FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;

// Phone, timezone, and tag are plain strings here and are checked in the
// handler, so a bad value comes back as a tool error with a reason (and gets
// an audit row) instead of a schema error from the SDK.
const upsertContactInput = z.object({
  phone: z
    .string()
    .max(30)
    .describe("Phone number in E.164 (+13125550101) or a US format like (312) 555-0101."),
  first_name: z.string().trim().min(1).max(100).optional().describe("First name."),
  last_name: z.string().trim().min(1).max(100).optional().describe("Last name."),
  timezone: z
    .string()
    .max(64)
    .optional()
    .describe("IANA timezone, e.g. America/Chicago. Needed before the contact can be texted."),
  custom_fields: z
    .record(
      z.string().regex(CUSTOM_FIELD_KEY, "Keys use lowercase letters, digits, and underscores."),
      z.string().max(500),
    )
    .optional()
    .describe('Extra fields for message templates, e.g. {"ward": "3"}. Merged with existing ones.'),
});

const tagContactsInput = z.object({
  contact_ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .describe("Contact ids from search_contacts, 1 to 100 per call."),
  tag: z
    .string()
    .max(50)
    .describe("Tag name, e.g. 'volunteers'. Saved lowercase. New tags are created on first use."),
  action: z
    .enum(["add", "remove"])
    .default("add")
    .describe("'add' puts the tag on the contacts, 'remove' takes it off."),
});

export function registerContactWriteTools(server: McpServer): void {
  server.registerTool(
    "upsert_contact",
    {
      title: "Create or update contact",
      description:
        "Create a contact, or update the existing contact with the same phone number. " +
        "The phone is saved in E.164 format; invalid numbers are refused. " +
        "Only the fields you pass change; leave a field out to keep its current value. " +
        "This tool never changes consent: opt-outs and opt-ins come from the contact's own replies " +
        "(STOP, START) or a CSV import's consent column. Use tag_contacts to change tags. " +
        "Returns the saved contact with its tags and consent status.",
      inputSchema: upsertContactInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withAudit("upsert_contact", async (args) => {
      const phone = normalizePhone(args.phone);
      if (!phone.ok) {
        return toolError(`${phone.reason} Nothing was saved.`);
      }

      let timezone: string | undefined;
      if (args.timezone !== undefined) {
        const checked = normalizeTimezone(args.timezone);
        if (!checked.ok) {
          return toolError(`${checked.reason} Nothing was saved.`);
        }
        timezone = checked.value;
      }

      const db = getDb();
      const report = await importContacts(
        db,
        [
          {
            phone_e164: phone.value,
            first_name: args.first_name,
            last_name: args.last_name,
            timezone,
            custom_fields: args.custom_fields,
          },
        ],
        { source: "mcp", dryRun: false },
      );

      const contact = await findContact(db, { phone: phone.value });
      if (!contact) {
        // withAudit turns this into a plain "server problem" message for the model.
        throw new Error("upsert_contact saved a contact but could not read it back");
      }

      const action = report.inserted > 0 ? "created" : "updated";
      const noTimezone = contact.timezone
        ? ""
        : " No timezone yet, so sends to this contact will be refused until one is set.";
      return toolResult(
        `${action === "created" ? "Created" : "Updated"} ${displayName(contact)} (${contact.phone}).${noTimezone}`,
        { action, contact },
      );
    }),
  );

  server.registerTool(
    "tag_contacts",
    {
      title: "Tag contacts",
      description:
        "Add a tag to, or remove a tag from, up to 100 contacts at once, by contact_id. " +
        "Tags are lowercase letters, digits, hyphens, or underscores; a new tag is created the first time it's added. " +
        "Contacts that already have the tag (or, for remove, don't have it) are counted as unchanged. " +
        "Ids that match no contact are skipped and listed in notFound. " +
        "Broadcasts pick their audience by tag, so check the result with search_contacts and the same tag.",
      inputSchema: tagContactsInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withAudit("tag_contacts", async (args) => {
      const tag = normalizeTag(args.tag);
      if (!tag.ok) {
        return toolError(tag.reason);
      }

      // The same id twice would count twice, so drop repeats first.
      const ids = [...new Set(args.contact_ids)];
      const db = getDb();
      const result =
        args.action === "add"
          ? await addTag(db, ids, tag.value)
          : await removeTag(db, ids, tag.value);

      const verb = args.action === "add" ? "Added" : "Removed";
      const preposition = args.action === "add" ? "to" : "from";
      const skipped = result.notFound.length
        ? ` ${result.notFound.length} id(s) matched no contact and were skipped.`
        : "";
      return toolResult(
        `${verb} "${tag.value}" ${preposition} ${result.changed} contact(s); ${result.unchanged} unchanged.${skipped}`,
        { tag: tag.value, action: args.action, ...result },
      );
    }),
  );
}
