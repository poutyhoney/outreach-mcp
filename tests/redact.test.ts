import { describe, expect, it } from "vitest";
import { maskPhone, maskPhonesInText, redactArgs } from "@/lib/mcp/redact";

describe("maskPhone", () => {
  it("keeps the country and area code and the last four digits", () => {
    expect(maskPhone("+13125550112")).toBe("+1312***0112");
  });
});

describe("maskPhonesInText", () => {
  it("masks every phone number inside a sentence", () => {
    expect(maskPhonesInText("from +13125550112 to +16175550116")).toBe(
      "from +1312***0112 to +1617***0116",
    );
  });
});

describe("redactArgs", () => {
  it("masks phones in nested objects and arrays", () => {
    expect(redactArgs({ contact: { phone: "+13125550112" }, phones: ["+16175550116"] })).toEqual({
      contact: { phone: "+1312***0112" },
      phones: ["+1617***0116"],
    });
  });

  it("shortens long text and keeps numbers and booleans", () => {
    const redacted = redactArgs({ body: "x".repeat(500), limit: 10, dry_run: true });
    expect(redacted).toEqual({
      body: `${"x".repeat(100)}... (500 chars)`,
      limit: 10,
      dry_run: true,
    });
  });

  it("turns undefined into null so the result is valid JSON", () => {
    expect(redactArgs({ cursor: undefined })).toEqual({ cursor: null });
  });
});
