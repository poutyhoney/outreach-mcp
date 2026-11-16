// Picks the provider and sender number from env vars. Send tools call
// getMessaging() and never read these env vars themselves.
import { MockProvider } from "./mock-provider";
import type { MessagingProvider } from "./provider";
import { isSandboxMode } from "./sandbox";
import { TwilioProvider } from "./twilio-provider";

type Env = Record<string, string | undefined>;

export interface Messaging {
  provider: MessagingProvider;
  from: string;
  sandbox: boolean;
}

const MOCK_FROM_NUMBER = "+18885550100";

// One MockProvider per server process, so local sends stay visible between calls.
let mockProvider: MockProvider | undefined;

export function getMockProvider(): MockProvider {
  mockProvider ??= new MockProvider();
  return mockProvider;
}

export function getMessaging(env: Env = process.env): Messaging {
  const sandbox = isSandboxMode(env);
  const providerName = env.MESSAGING_PROVIDER || "mock";

  if (providerName === "mock") {
    return {
      provider: getMockProvider(),
      from: env.TWILIO_FROM_NUMBER || MOCK_FROM_NUMBER,
      sandbox,
    };
  }

  if (providerName === "twilio") {
    const provider = new TwilioProvider({
      accountSid: required(env, "TWILIO_ACCOUNT_SID"),
      apiKeySid: required(env, "TWILIO_API_KEY_SID"),
      apiKeySecret: required(env, "TWILIO_API_KEY_SECRET"),
    });
    return { provider, from: required(env, "TWILIO_FROM_NUMBER"), sandbox };
  }

  throw new Error(`MESSAGING_PROVIDER must be "mock" or "twilio", not "${providerName}".`);
}

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} must be set when MESSAGING_PROVIDER is "twilio". See .env.example.`);
  }
  return value;
}
