export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        maxWidth: 640,
      }}
    >
      <h1>Outreach MCP</h1>
      <p>
        A remote MCP server for managing contacts and sending SMS with server-side compliance
        guardrails. The MCP endpoint will live at <code>/api/mcp</code>.
      </p>
    </main>
  );
}
