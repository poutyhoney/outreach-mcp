import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/messaging/mock-provider";
import { ProviderError } from "@/lib/messaging/provider";

const message = { to: "+18777804236", from: "+18885550100", body: "Hello" };

describe("MockProvider", () => {
  it("records sends and returns predictable ids", async () => {
    const provider = new MockProvider();

    expect(await provider.send(message)).toEqual({ providerMessageId: "mock-1", status: "queued" });
    expect(await provider.send(message)).toEqual({ providerMessageId: "mock-2", status: "queued" });
    expect(provider.sent).toHaveLength(2);
  });

  it("fails the next sends when told to, then recovers", async () => {
    const provider = new MockProvider();
    provider.failNext(1, "21211", "Invalid To number");

    await expect(provider.send(message)).rejects.toMatchObject({
      name: "ProviderError",
      code: "21211",
    });
    await expect(provider.send(message)).resolves.toMatchObject({ providerMessageId: "mock-1" });
    expect(provider.sent).toHaveLength(1);
  });

  it("reports and updates status", async () => {
    const provider = new MockProvider();
    const { providerMessageId } = await provider.send(message);

    expect(await provider.getStatus(providerMessageId)).toEqual({ status: "queued" });
    provider.setStatus(providerMessageId, { status: "undelivered", errorCode: "30003" });
    expect(await provider.getStatus(providerMessageId)).toEqual({
      status: "undelivered",
      errorCode: "30003",
    });
  });

  it("throws a ProviderError for an unknown id", async () => {
    await expect(new MockProvider().getStatus("nope")).rejects.toBeInstanceOf(ProviderError);
  });
});
