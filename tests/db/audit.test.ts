import type { ServerContext } from "@modelcontextprotocol/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey } from "@/lib/auth/api-keys";
import { createDb, type Db } from "@/lib/db/client";
import { withAudit } from "@/lib/mcp/audit";

const TOOL_OK = "test_audit_ok";
const TOOL_THROWS = "test_audit_throws";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Start Supabase locally and fill in .env.local.`);
  }
  return value;
}

let db: Db;
let apiKeyId: string;
let ctx: ServerContext;

beforeAll(async () => {
  const url = requireEnv("SUPABASE_URL");
  const { hostname } = new URL(url);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run DB tests against ${hostname}. Use the local stack.`);
  }
  db = createDb(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  ({ id: apiKeyId } = await createApiKey(db, "test-audit"));
  // Only the part of the context that withAudit reads.
  ctx = {
    http: { authInfo: { token: "unused", clientId: apiKeyId, scopes: [] } },
  } as unknown as ServerContext;
});

afterAll(async () => {
  await db.from("audit_log").delete().in("tool_name", [TOOL_OK, TOOL_THROWS]);
  await db.from("api_keys").delete().eq("id", apiKeyId);
});

async function latestRow(toolName: string) {
  const { data, error } = await db
    .from("audit_log")
    .select("*")
    .eq("tool_name", toolName)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

describe("withAudit", () => {
  it("records a successful call with the key id and masked args", async () => {
    const tool = withAudit(TOOL_OK, async (args: { phone: string }) => ({
      content: [{ type: "text", text: `Found 1 contact for ${args.phone}` }],
    }));

    const result = await tool({ phone: "+13125550112" }, ctx);
    expect(result.isError).toBeUndefined();

    const row = await latestRow(TOOL_OK);
    expect(row.ok).toBe(true);
    expect(row.api_key_id).toBe(apiKeyId);
    expect(row.args_redacted).toEqual({ phone: "+1312***0112" });
    expect(row.result_summary).toBe("Found 1 contact for +1312***0112");
  });

  it("turns a thrown error into a plain tool error and records ok = false", async () => {
    const tool = withAudit(TOOL_THROWS, async () => {
      throw new Error("connection reset");
    });

    const result = await tool({}, ctx);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("connection reset");

    const row = await latestRow(TOOL_THROWS);
    expect(row.ok).toBe(false);
    expect(row.result_summary).toBe("server error: connection reset");
  });
});
