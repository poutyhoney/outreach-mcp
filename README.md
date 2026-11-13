# Outreach MCP

A remote MCP server, built on Next.js and Supabase, that lets an AI client manage contacts and send
SMS through a messaging provider. Texting compliance rules (opt-outs, sending windows, two-step
broadcast confirmation) are enforced in server code, not left to the model.

> Status: Milestone 0 (skeleton). See [BUILD-BRIEF.md](BUILD-BRIEF.md) for the plan.

## Architecture

```
MCP client (Claude / Claude Code / Inspector)
        │  Streamable HTTP, Bearer API key
        ▼
Next.js on Vercel
  /api/mcp                → MCP tools
  /api/webhooks/inbound   → inbound SMS (STOP/START/HELP, replies)
  /api/webhooks/status    → delivery status callbacks
        │
        ├── Supabase Postgres (contacts, consent, messages, broadcasts, api_keys, audit_log)
        └── MessagingProvider interface
              ├── MockProvider (tests and local dev)
              └── TwilioProvider (sandbox-routed to the Twilio Virtual Phone)
```

## Local development

Requires Node 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

Checks (the same ones CI runs):

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

The Supabase CLI is a dev dependency. Run it with `npx supabase ...`.

## Still to write

Setup from zero (Supabase, Twilio trial and Virtual Phone, Vercel), connecting clients, the
guardrails, the webhook signature URL pitfall, sandbox mode, and known limitations.
