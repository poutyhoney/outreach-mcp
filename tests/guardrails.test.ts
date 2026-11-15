import { describe, expect, it } from "vitest";
import {
  addOptOutFooter,
  checkBody,
  checkSend,
  checkSendingWindow,
  MAX_BODY_LENGTH,
  OPT_OUT_FOOTER,
  type SendTarget,
} from "@/lib/messaging/guardrails";

// 2026-11-16 18:00 UTC is 12:00 in Chicago and 3:00 the next morning in Tokyo.
const NOON_CHICAGO = new Date("2026-11-16T18:00:00Z");

const maya: SendTarget = {
  name: "Maya Okafor",
  timezone: "America/Chicago",
  consentStatus: "opt_in",
  isFirstMessage: false,
};

describe("checkSend", () => {
  it("allows an opted-in contact inside the window", () => {
    expect(checkSend(maya, "Meeting at 6pm.", NOON_CHICAGO)).toEqual({
      ok: true,
      body: "Meeting at 6pm.",
    });
  });

  it("refuses an opted-out contact", () => {
    const result = checkSend({ ...maya, consentStatus: "opt_out" }, "Hi", NOON_CHICAGO);
    expect(result).toMatchObject({ ok: false, code: "opted_out" });
  });

  it("checks consent before anything else", () => {
    const optedOutNoTimezone = { ...maya, consentStatus: "opt_out" as const, timezone: null };
    expect(checkSend(optedOutNoTimezone, "", NOON_CHICAGO)).toMatchObject({ code: "opted_out" });
  });

  it("allows a contact with no consent record", () => {
    expect(checkSend({ ...maya, consentStatus: null }, "Hi", NOON_CHICAGO).ok).toBe(true);
  });

  it("refuses when the timezone is unknown", () => {
    const result = checkSend({ ...maya, timezone: null }, "Hi", NOON_CHICAGO);
    expect(result).toMatchObject({ ok: false, code: "missing_timezone" });
  });

  it("refuses outside the contact's local window", () => {
    const result = checkSend({ ...maya, timezone: "Asia/Tokyo" }, "Hi", NOON_CHICAGO);
    expect(result).toMatchObject({ ok: false, code: "outside_window" });
    if (!result.ok) {
      expect(result.reason).toContain("3:00");
    }
  });

  it("adds the opt-out footer to a first message", () => {
    const result = checkSend({ ...maya, isFirstMessage: true }, "Welcome!", NOON_CHICAGO);
    expect(result).toEqual({ ok: true, body: `Welcome!\n\n${OPT_OUT_FOOTER}` });
  });

  it("counts the footer toward the length limit", () => {
    const body = "a".repeat(MAX_BODY_LENGTH - 5);
    expect(checkSend(maya, body, NOON_CHICAGO).ok).toBe(true);
    expect(checkSend({ ...maya, isFirstMessage: true }, body, NOON_CHICAGO)).toMatchObject({
      code: "body_too_long",
    });
  });
});

describe("checkBody", () => {
  it("refuses an empty or blank body", () => {
    expect(checkBody("")).toMatchObject({ ok: false, code: "empty_body" });
    expect(checkBody("   \n ")).toMatchObject({ ok: false, code: "empty_body" });
  });

  it("allows exactly the limit and refuses one more", () => {
    expect(checkBody("a".repeat(MAX_BODY_LENGTH)).ok).toBe(true);
    expect(checkBody("a".repeat(MAX_BODY_LENGTH + 1))).toMatchObject({ code: "body_too_long" });
  });

  it("counts an emoji as one character", () => {
    expect(checkBody("🎉".repeat(MAX_BODY_LENGTH)).ok).toBe(true);
  });
});

describe("addOptOutFooter", () => {
  it("leaves a body that already mentions STOP alone", () => {
    expect(addOptOutFooter("Text stop to quit.")).toBe("Text stop to quit.");
  });

  it("doesn't treat a word containing stop as the keyword", () => {
    expect(addOptOutFooter("Bus stops at 5.")).toBe(`Bus stops at 5.\n\n${OPT_OUT_FOOTER}`);
  });
});

describe("checkSendingWindow", () => {
  const at = (iso: string) => new Date(iso);

  it.each([
    ["2026-11-16T13:59:00Z", false], // 7:59 Chicago
    ["2026-11-16T14:00:00Z", true], //  8:00 Chicago
    ["2026-11-17T02:59:00Z", true], // 20:59 Chicago
    ["2026-11-17T03:00:00Z", false], // 21:00 Chicago
  ])("at %s the window is open: %s", (iso, open) => {
    expect(checkSendingWindow("America/Chicago", at(iso)).ok).toBe(open);
  });

  it("refuses a timezone name it doesn't recognize", () => {
    expect(checkSendingWindow("Mars/Base", NOON_CHICAGO)).toMatchObject({
      ok: false,
      code: "missing_timezone",
    });
  });
});
