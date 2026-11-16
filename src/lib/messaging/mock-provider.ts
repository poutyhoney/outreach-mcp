import {
  ProviderError,
  type MessagingProvider,
  type SendInput,
  type SendResult,
  type StatusResult,
} from "./provider";

// A provider that sends nothing. It records each send in memory and returns
// ids like mock-<uuid>. Used in tests and local development.
export class MockProvider implements MessagingProvider {
  readonly name = "mock";
  readonly sent: SendInput[] = [];

  private statuses = new Map<string, StatusResult>();
  private failuresLeft = 0;
  private failure = { code: "", message: "" };

  // Make the next `times` sends throw, like a real provider would for a bad
  // number. 30003 is Twilio's "unreachable destination handset".
  failNext(times = 1, code = "30003", message = "Unreachable destination handset"): void {
    this.failuresLeft = times;
    this.failure = { code, message };
  }

  async send(input: SendInput): Promise<SendResult> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new ProviderError(this.failure.message, this.failure.code);
    }

    this.sent.push(input);
    // Unique across server restarts, because messages has a unique index on
    // (provider, provider_message_id). A counter would restart at mock-1.
    const providerMessageId = `mock-${crypto.randomUUID()}`;
    this.statuses.set(providerMessageId, { status: "queued" });
    return { providerMessageId, status: "queued" };
  }

  async getStatus(providerMessageId: string): Promise<StatusResult> {
    const status = this.statuses.get(providerMessageId);
    if (!status) {
      throw new ProviderError(`No message with id ${providerMessageId}.`, "20404");
    }
    return status;
  }

  // Move a message to a new status, the way a delivery callback would.
  setStatus(providerMessageId: string, status: StatusResult): void {
    this.statuses.set(providerMessageId, status);
  }
}
