import twilio from "twilio";
import {
  ProviderError,
  type MessagingProvider,
  type SendInput,
  type SendResult,
  type StatusResult,
} from "./provider";

export interface TwilioCredentials {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
}

// Sends through Twilio's Messaging API. It signs in with an API key (SK...)
// instead of the account auth token, so the key can be revoked on its own.
export class TwilioProvider implements MessagingProvider {
  readonly name = "twilio";
  private client: twilio.Twilio;

  constructor({ accountSid, apiKeySid, apiKeySecret }: TwilioCredentials) {
    this.client = twilio(apiKeySid, apiKeySecret, { accountSid });
  }

  async send({ to, from, body, statusCallbackUrl }: SendInput): Promise<SendResult> {
    try {
      const message = await this.client.messages.create({
        to,
        from,
        body,
        statusCallback: statusCallbackUrl,
      });
      return { providerMessageId: message.sid, status: message.status };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async getStatus(providerMessageId: string): Promise<StatusResult> {
    try {
      const message = await this.client.messages(providerMessageId).fetch();
      if (message.errorCode) {
        return { status: message.status, errorCode: String(message.errorCode) };
      }
      return { status: message.status };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

// Twilio throws a RestException with a numeric code, for example 21211 for an
// invalid To number. Anything else (a timeout, a DNS failure) gets "network".
export function toProviderError(error: unknown): ProviderError {
  if (error instanceof twilio.RestException) {
    return new ProviderError(error.message, String(error.code ?? error.status));
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderError(message, "network");
}
