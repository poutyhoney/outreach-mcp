import { describe, expect, it } from "vitest";
import { isSandboxMode, resolveRecipient, TWILIO_VIRTUAL_PHONE } from "@/lib/messaging/sandbox";

describe("isSandboxMode", () => {
  it("is on by default", () => {
    expect(isSandboxMode({})).toBe(true);
  });

  it("is off only for the exact string false", () => {
    expect(isSandboxMode({ SANDBOX_MODE: "false" })).toBe(false);
    expect(isSandboxMode({ SANDBOX_MODE: "False" })).toBe(true);
    expect(isSandboxMode({ SANDBOX_MODE: "0" })).toBe(true);
    expect(isSandboxMode({ SANDBOX_MODE: "" })).toBe(true);
  });

  it("is forced on in Vercel preview deployments", () => {
    expect(isSandboxMode({ SANDBOX_MODE: "false", VERCEL_ENV: "preview" })).toBe(true);
  });
});

describe("resolveRecipient", () => {
  it("sends to the Virtual Phone in sandbox mode", () => {
    expect(resolveRecipient("+13125550101", true)).toEqual({
      sendTo: TWILIO_VIRTUAL_PHONE,
      sandboxRedirectedTo: TWILIO_VIRTUAL_PHONE,
    });
  });

  it("sends to the contact when sandbox mode is off", () => {
    expect(resolveRecipient("+13125550101", false)).toEqual({
      sendTo: "+13125550101",
      sandboxRedirectedTo: null,
    });
  });
});
