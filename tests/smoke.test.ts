import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/version";

describe("smoke", () => {
  it("loads the app module", () => {
    expect(APP_NAME).toBe("outreach-mcp");
  });
});
