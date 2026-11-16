import { describe, expect, it } from "vitest";
import {
  type AudienceMember,
  audienceHash,
  planBroadcast,
  renderTemplate,
} from "@/lib/messaging/broadcast";
import { OPT_OUT_FOOTER } from "@/lib/messaging/guardrails";

const NOON_CHICAGO = new Date("2026-11-16T18:00:00Z");

let nextId = 1;
function member(overrides: Partial<AudienceMember> = {}): AudienceMember {
  return {
    id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
    firstName: "Maya",
    lastName: "Okafor",
    phone: "+13125550101",
    timezone: "America/Chicago",
    consentStatus: "opt_in",
    customFields: {},
    ...overrides,
  };
}

describe("renderTemplate", () => {
  it("fills name and custom fields, with or without spaces in the braces", () => {
    const maya = member({ customFields: { ward: "3" } });
    expect(renderTemplate("Hi {{first_name}}, ward {{ ward }} meets Thursday.", maya)).toEqual({
      ok: true,
      body: "Hi Maya, ward 3 meets Thursday.",
    });
  });

  it("reports each missing or blank field once", () => {
    const noName = member({ firstName: "  ", customFields: {} });
    expect(renderTemplate("{{first_name}} {{ward}} {{first_name}}", noName)).toEqual({
      ok: false,
      missing: ["first_name", "ward"],
    });
  });

  it("doesn't read built-in object properties as fields", () => {
    expect(renderTemplate("{{constructor}}", member())).toEqual({
      ok: false,
      missing: ["constructor"],
    });
  });
});

describe("planBroadcast", () => {
  it("sorts the audience into sends and skips, with counts", () => {
    const newContact = member({ firstName: "Tess" });
    const messagedBefore = member({ firstName: "Maya" });
    const audience = [
      newContact,
      messagedBefore,
      member({ firstName: "Jonah", consentStatus: "opt_out" }),
      member({ firstName: "Leo", consentStatus: null }),
      member({ firstName: "Theo", timezone: null }),
      member({ firstName: "Lucy", timezone: "Asia/Tokyo" }),
      member({ firstName: null }),
    ];

    const plan = planBroadcast(
      audience,
      "Hi {{first_name}}!",
      new Set([messagedBefore.id]),
      NOON_CHICAGO,
    );

    expect(plan.sends.map((send) => send.body)).toEqual([
      `Hi Tess!\n\n${OPT_OUT_FOOTER}`,
      "Hi Maya!",
    ]);
    expect(plan.skipCounts).toEqual({
      opted_out: 1,
      no_consent: 1,
      missing_timezone: 1,
      outside_window: 1,
      missing_merge_field: 1,
    });
  });

  it("reports an opt-out before a missing field", () => {
    const optedOut = member({ firstName: null, consentStatus: "opt_out" });
    const plan = planBroadcast([optedOut], "Hi {{first_name}}!", new Set(), NOON_CHICAGO);
    expect(plan.skips.map((skip) => skip.code)).toEqual(["opted_out"]);
  });
});

describe("audienceHash", () => {
  it("ignores order but notices a consent change", () => {
    const a = member();
    const b = member();
    expect(audienceHash([a, b])).toBe(audienceHash([b, a]));
    expect(audienceHash([a, b])).not.toBe(audienceHash([a, { ...b, consentStatus: "opt_out" }]));
  });
});
