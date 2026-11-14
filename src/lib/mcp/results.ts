import type { CallToolResult } from "@modelcontextprotocol/server";

// A successful tool result: a one-line summary first (also what the audit log
// stores), then the same data as JSON text for clients that ignore
// structuredContent, then the structured data itself.
export function toolResult(summary: string, data: Record<string, unknown>): CallToolResult {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
    structuredContent: data,
  };
}

// A refusal or a "not found" the model can act on. Not for crashes:
// withAudit handles thrown errors.
export function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}
