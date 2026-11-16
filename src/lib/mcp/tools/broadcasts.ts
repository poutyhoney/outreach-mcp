import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { normalizeTag } from "@/lib/contacts/validate";
import {
  CONFIRM_TOKEN_TTL_MINUTES,
  createBroadcast,
  createConfirmToken,
  getTagAudience,
  MAX_AUDIENCE_SIZE,
} from "@/lib/db/broadcasts";
import { getDb } from "@/lib/db/client";
import { messagedContactIds } from "@/lib/db/messages";
import { withAudit } from "@/lib/mcp/audit";
import { toolError, toolResult } from "@/lib/mcp/results";
import {
  audienceHash,
  type BroadcastPlan,
  MAX_BROADCAST_RECIPIENTS,
  memberName,
  planBroadcast,
} from "@/lib/messaging/broadcast";

const SAMPLE_COUNT = 3;

const previewBroadcastInput = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("A short name, e.g. 'Volunteer night reminder'."),
  body_template: z
    .string()
    .max(1600)
    .describe(
      "The message, with optional fields: {{first_name}}, {{last_name}}, or a custom field like {{ward}}.",
    ),
  tag: z.string().max(50).describe("Send to contacts with this tag, e.g. 'volunteers'."),
});

// "2 opted_out, 1 missing_timezone"
function describeSkips(skipCounts: BroadcastPlan["skipCounts"]): string {
  return Object.entries(skipCounts)
    .map(([code, count]) => `${count} ${code}`)
    .join(", ");
}

export function registerBroadcastTools(server: McpServer): void {
  server.registerTool(
    "preview_broadcast",
    {
      title: "Preview broadcast",
      description:
        "Plan a text to every contact with one tag. Sends nothing. " +
        "Returns how many would get it, who would be skipped and why (opted_out, no_consent, missing_timezone, " +
        "outside_window, missing_merge_field, ...), 3 rendered samples, a broadcast_id, and a one-time confirm_token. " +
        `Show the user the counts, skips, and samples. Only if they say yes, call send_broadcast with broadcast_id and confirm_token within ${CONFIRM_TOKEN_TTL_MINUTES} minutes. ` +
        `At most ${MAX_BROADCAST_RECIPIENTS} recipients per broadcast.`,
      inputSchema: previewBroadcastInput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    withAudit("preview_broadcast", async (args) => {
      const tag = normalizeTag(args.tag);
      if (!tag.ok) {
        return toolError(tag.reason);
      }
      const template = args.body_template.trim();
      if (template === "") {
        return toolError("The message template is empty.");
      }

      const db = getDb();
      const audience = await getTagAudience(db, tag.value);
      if (audience === null) {
        return toolError(
          `More than ${MAX_AUDIENCE_SIZE} contacts have the tag "${tag.value}". Use a narrower tag.`,
        );
      }
      if (audience.length === 0) {
        return toolError(
          `No contacts have the tag "${tag.value}". Check the tag name with search_contacts.`,
        );
      }

      const now = new Date();
      const messaged = await messagedContactIds(
        db,
        audience.map((member) => member.id),
      );
      const plan = planBroadcast(audience, template, messaged, now);
      const skipped = plan.skips.map((skip) => ({
        contactId: skip.member.id,
        name: memberName(skip.member),
        code: skip.code,
        reason: skip.reason,
      }));
      const counts = {
        audienceCount: audience.length,
        sendCount: plan.sends.length,
        skipCounts: plan.skipCounts,
      };

      if (plan.sends.length === 0) {
        return toolResult(
          `Nothing to send: all ${audience.length} contacts tagged "${tag.value}" would be skipped (${describeSkips(plan.skipCounts)}). No broadcast was created.`,
          { ...counts, skipped },
        );
      }
      if (plan.sends.length > MAX_BROADCAST_RECIPIENTS) {
        return toolError(
          `This broadcast would reach ${plan.sends.length} contacts. The limit is ${MAX_BROADCAST_RECIPIENTS}. Use a narrower tag.`,
        );
      }

      const { token, hash } = createConfirmToken();
      const broadcast = await createBroadcast(db, {
        name: args.name,
        bodyTemplate: template,
        tag: tag.value,
        previewCount: plan.sends.length,
        confirmTokenHash: hash,
        audienceHash: audienceHash(audience),
      });
      const expiresAt = new Date(
        new Date(broadcast.createdAt).getTime() + CONFIRM_TOKEN_TTL_MINUTES * 60_000,
      ).toISOString();

      // The summary is what the audit log stores, so the token stays out of it.
      const skipText = plan.skips.length > 0 ? ` (${describeSkips(plan.skipCounts)})` : "";
      return toolResult(
        `Preview "${args.name}": ${plan.sends.length} of ${audience.length} contacts tagged "${tag.value}" would get it, ` +
          `${plan.skips.length} skipped${skipText}. Show the user this preview. ` +
          `If they confirm, call send_broadcast before ${expiresAt}.`,
        {
          broadcastId: broadcast.id,
          confirmToken: token,
          expiresAt,
          ...counts,
          skipped,
          samples: plan.sends.slice(0, SAMPLE_COUNT).map((send) => ({
            name: memberName(send.member),
            body: send.body,
          })),
        },
      );
    }),
  );
}
