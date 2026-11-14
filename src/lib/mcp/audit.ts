import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server";
import { getDb } from "@/lib/db/client";
import type { TablesInsert } from "@/lib/db/database.types";
import { maskPhonesInText, redactArgs, truncate } from "@/lib/mcp/redact";

export type ToolHandler<Args> = (args: Args, ctx: ServerContext) => Promise<CallToolResult>;

// Wraps a tool handler so every call writes one audit_log row, whether it
// succeeds, returns a tool error, or throws.
export function withAudit<Args>(toolName: string, handler: ToolHandler<Args>): ToolHandler<Args> {
  return async (args, ctx) => {
    let result: CallToolResult;
    let summary: string;

    try {
      result = await handler(args, ctx);
      summary = firstText(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${toolName}] ${maskPhonesInText(message)}`);
      summary = `server error: ${message}`;
      // The model sees a plain explanation, never the internal error or a stack trace.
      result = {
        isError: true,
        content: [
          {
            type: "text",
            text: `${toolName} failed because of a server problem. Try once more. If it fails again, tell the user the server needs attention.`,
          },
        ],
      };
    }

    await recordToolCall({
      api_key_id: ctx.http?.authInfo?.clientId ?? null,
      tool_name: toolName,
      args_redacted: redactArgs(args) ?? {},
      result_summary: truncate(maskPhonesInText(summary), 200),
      ok: !result.isError,
    });
    return result;
  };
}

function firstText(result: CallToolResult): string {
  for (const item of result.content) {
    if (item.type === "text") {
      return item.text;
    }
  }
  return "";
}

// A failed audit write is logged but does not fail the tool call.
async function recordToolCall(row: TablesInsert<"audit_log">): Promise<void> {
  const { error } = await getDb().from("audit_log").insert(row);
  if (error) {
    console.error(`[audit] could not record ${row.tool_name}: ${error.message}`);
  }
}
