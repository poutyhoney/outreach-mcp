// The contract every SMS provider implements. Send tools talk only to this
// interface, so adding a provider means writing one new class.

export interface SendInput {
  to: string;
  from: string;
  body: string;
  statusCallbackUrl?: string;
}

export interface SendResult {
  providerMessageId: string;
  status: string;
}

export interface StatusResult {
  status: string;
  errorCode?: string;
}

export interface MessagingProvider {
  name: string;
  send(input: SendInput): Promise<SendResult>;
  getStatus(providerMessageId: string): Promise<StatusResult>;
}

// What a provider throws when it refuses a send or a lookup. `code` is the
// provider's own error code, saved to messages.error_code.
export class ProviderError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}
