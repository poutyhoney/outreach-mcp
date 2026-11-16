// Broadcast planning, as pure functions. For each contact in the audience,
// render the template and decide "send" or "skip, and why". preview_broadcast
// shows the plan; send_broadcast builds it again right before sending.
import { createHash } from "node:crypto";
import type { Enums } from "@/lib/db/database.types";
import { checkSend, type RefusalCode } from "./guardrails";

export const MAX_BROADCAST_RECIPIENTS = 50;

// {{first_name}}, {{ last_name }}, {{ward}}: letters, digits, underscores.
const MERGE_FIELD = /\{\{\s*(\w+)\s*\}\}/g;

export type SkipCode = RefusalCode | "missing_merge_field";

export interface AudienceMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  timezone: string | null;
  consentStatus: Enums<"consent_type"> | null;
  customFields: Record<string, string>;
}

export type RenderResult = { ok: true; body: string } | { ok: false; missing: string[] };

export interface PlannedSend {
  member: AudienceMember;
  body: string;
}

export interface PlannedSkip {
  member: AudienceMember;
  code: SkipCode;
  reason: string;
}

export interface BroadcastPlan {
  sends: PlannedSend[];
  skips: PlannedSkip[];
  skipCounts: Partial<Record<SkipCode, number>>;
}

// Fills {{first_name}}, {{last_name}}, and custom fields like {{ward}}. A field
// that's missing or blank for this contact is reported, never sent empty.
export function renderTemplate(template: string, member: AudienceMember): RenderResult {
  const missing = new Set<string>();
  const body = template.replace(MERGE_FIELD, (_match, field: string) => {
    const value = fieldValue(member, field)?.trim();
    if (!value) {
      missing.add(field);
      return "";
    }
    return value;
  });
  return missing.size > 0 ? { ok: false, missing: [...missing] } : { ok: true, body };
}

function fieldValue(member: AudienceMember, field: string): string | null | undefined {
  if (field === "first_name") return member.firstName;
  if (field === "last_name") return member.lastName;
  // Object.hasOwn, not member.customFields[field]: a template saying
  // {{constructor}} must not find the built-in Object.prototype.constructor.
  return Object.hasOwn(member.customFields, field) ? member.customFields[field] : undefined;
}

export function memberName(member: AudienceMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(" ") || "(no name)";
}

// `messagedIds` holds the contacts who already got a message, so their
// broadcast text goes out without the opt-out footer.
export function planBroadcast(
  audience: AudienceMember[],
  template: string,
  messagedIds: Set<string>,
  now: Date,
): BroadcastPlan {
  const plan: BroadcastPlan = { sends: [], skips: [], skipCounts: {} };

  for (const member of audience) {
    const name = memberName(member);
    const rendered = renderTemplate(template, member);
    const target = {
      name,
      timezone: member.timezone,
      consentStatus: member.consentStatus,
      isFirstMessage: !messagedIds.has(member.id),
    };
    // If rendering failed, check the raw template instead, so an opt-out or a
    // window refusal still wins over a missing field.
    const check = checkSend(target, rendered.ok ? rendered.body : template, now);

    if (!check.ok) {
      addSkip(plan, { member, code: check.code, reason: check.reason });
    } else if (!rendered.ok) {
      addSkip(plan, {
        member,
        code: "missing_merge_field",
        reason: `${name} has no value for ${rendered.missing.join(", ")}.`,
      });
    } else {
      plan.sends.push({ member, body: check.body });
    }
  }
  return plan;
}

function addSkip(plan: BroadcastPlan, skip: PlannedSkip): void {
  plan.skips.push(skip);
  plan.skipCounts[skip.code] = (plan.skipCounts[skip.code] ?? 0) + 1;
}

// A fingerprint of who is in the audience and their consent. send_broadcast
// compares it with the one saved at preview time. If anyone joined or left the
// tag, or opted in or out, the hash changes and the send is refused.
export function audienceHash(audience: AudienceMember[]): string {
  const lines = audience.map((member) => `${member.id}:${member.consentStatus ?? "none"}`).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}
