import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiKey } from "@/lib/auth/api-keys";
import { getDb } from "@/lib/db/client";
import { COMPLIANCE_RULES, COMPLIANCE_RULES_URI } from "@/lib/mcp/compliance-rules";
import { registerContactTools } from "@/lib/mcp/tools/contacts";
import { registerMessageTools } from "@/lib/mcp/tools/messages";
import { APP_NAME } from "@/lib/version";

const handler = createMcpHandler(
  (server) => {
    registerContactTools(server);
    registerMessageTools(server);

    server.registerResource(
      "compliance-rules",
      COMPLIANCE_RULES_URI,
      {
        title: "Compliance rules",
        description: "The messaging guardrails this server enforces. Read before sending.",
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: COMPLIANCE_RULES }],
      }),
    );
  },
  { serverInfo: { name: APP_NAME, version: "0.1.0" } },
);

async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined;
  }
  const apiKey = await verifyApiKey(getDb(), bearerToken);
  if (!apiKey) {
    return undefined;
  }
  return {
    token: bearerToken,
    clientId: apiKey.id,
    scopes: [],
    extra: { apiKeyName: apiKey.name },
  };
}

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
