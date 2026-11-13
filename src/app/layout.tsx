import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outreach MCP",
  description: "Remote MCP server for contacts and SMS with server-side guardrails.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
