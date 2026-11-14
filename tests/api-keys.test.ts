import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, generateApiKey, hashApiKey } from "@/lib/auth/api-keys";

describe("generateApiKey", () => {
  it("starts with the prefix and is long enough to be unguessable", () => {
    const key = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    // 32 random bytes as base64url = 43 characters.
    expect(key.length).toBe(API_KEY_PREFIX.length + 43);
  });

  it("never returns the same key twice", () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe("hashApiKey", () => {
  it("is a stable 64-character hex SHA-256 digest", () => {
    const hash = hashApiKey("omcp_example");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey("omcp_example")).toBe(hash);
  });

  it("does not contain the key itself", () => {
    expect(hashApiKey("omcp_example")).not.toContain("example");
  });
});
