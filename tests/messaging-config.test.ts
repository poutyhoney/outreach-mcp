import twilio from "twilio";
import { describe, expect, it } from "vitest";
import { getMessaging, getMockProvider } from "@/lib/messaging/config";
import { ProviderError } from "@/lib/messaging/provider";
import { toProviderError, TwilioProvider } from "@/lib/messaging/twilio-provider";

// Fake values in the right shape. Creating the client makes no network call.
const twilioEnv = {
  MESSAGING_PROVIDER: "twilio",
  TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
  TWILIO_API_KEY_SID: "SK00000000000000000000000000000000",
  TWILIO_API_KEY_SECRET: "not-a-real-secret",
  TWILIO_FROM_NUMBER: "+18885550100",
};

describe("getMessaging", () => {
  it("uses the shared mock provider, in sandbox mode, by default", () => {
    const messaging = getMessaging({});
    expect(messaging.provider).toBe(getMockProvider());
    expect(messaging.sandbox).toBe(true);
  });

  it("builds a Twilio provider when asked", () => {
    const messaging = getMessaging(twilioEnv);
    expect(messaging.provider).toBeInstanceOf(TwilioProvider);
    expect(messaging.from).toBe("+18885550100");
  });

  it("names the missing variable", () => {
    const missingSecret = { ...twilioEnv, TWILIO_API_KEY_SECRET: undefined };
    expect(() => getMessaging(missingSecret)).toThrow("TWILIO_API_KEY_SECRET");
  });

  it("rejects an unknown provider name", () => {
    expect(() => getMessaging({ MESSAGING_PROVIDER: "carrier-pigeon" })).toThrow(
      'must be "mock" or "twilio"',
    );
  });
});

describe("toProviderError", () => {
  it("keeps Twilio's error code", () => {
    const restError = new twilio.RestException({
      statusCode: 400,
      body: { code: 21211, message: "Invalid 'To' Phone Number" },
    });
    const error = toProviderError(restError);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: "21211", message: "Invalid 'To' Phone Number" });
  });

  it("labels other failures as network errors", () => {
    expect(toProviderError(new Error("socket hang up"))).toMatchObject({ code: "network" });
  });
});
