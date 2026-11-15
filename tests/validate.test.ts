import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeTag, normalizeTimezone } from "@/lib/contacts/validate";

describe("normalizePhone", () => {
  it.each([
    ["+13125550101", "+13125550101"],
    ["(312) 555-0101", "+13125550101"],
    ["312.555.0101", "+13125550101"],
    ["1-312-555-0101", "+13125550101"],
    ["  3125550101 ", "+13125550101"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("normalizes %j to %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ["", "empty"],
    ["555-0101", "10-digit"],
    ["(012) 555-0101", "can't start with 0 or 1"],
    ["+11234567890", "can't start with 0 or 1"],
    ["312-555-01O1", "characters"],
    ["312+5550101", "characters"],
    ["+4420", "8 to 15 digits"],
  ])("rejects %j", (input, reasonPart) => {
    const result = normalizePhone(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain(reasonPart);
    }
  });
});

describe("normalizeTimezone", () => {
  it("returns the canonical spelling", () => {
    expect(normalizeTimezone("america/chicago")).toEqual({ ok: true, value: "America/Chicago" });
    expect(normalizeTimezone(" UTC ")).toEqual({ ok: true, value: "UTC" });
  });

  it("rejects unknown names and abbreviations", () => {
    expect(normalizeTimezone("Mars/Base").ok).toBe(false);
    expect(normalizeTimezone("EST").ok).toBe(false);
  });
});

describe("normalizeTag", () => {
  it("lowercases and trims", () => {
    expect(normalizeTag(" Volunteers ")).toEqual({ ok: true, value: "volunteers" });
  });

  it("rejects spaces, a leading hyphen, and empty tags", () => {
    expect(normalizeTag("new tag").ok).toBe(false);
    expect(normalizeTag("-x").ok).toBe(false);
    expect(normalizeTag("").ok).toBe(false);
  });
});
