# Build brief: Outreach MCP (a messaging MCP server on Next.js + Supabase)

*For Claude Code. Written 2026-11-11 for Tom De Carlo. Put this file in the root of a new, empty repo and start Claude Code with: "Read BUILD-BRIEF.md and start Milestone 0. Stop at the end of each milestone so I can review."*

---

## 1. Why this exists

I'm applying for a Solutions Engineer role at a texting platform for political campaigns, unions and nonprofits. The job owns a Next.js + Supabase "solutions" app, ships small customer integrations weekly, and maintains the company's MCP server. My gaps for that role are Supabase, Postgres (my SQL is BigQuery), building an MCP server, and recent experience shipping through small PRs on a release schedule. This project closes all four in one public repo I can demo.

It's my own project. Don't name it after or brand it as any real company. Use fictional contacts only.

## 2. What we're building

A Next.js app, deployed on Vercel, that hosts a remote MCP server at `/api/mcp`. An AI client (Claude, Claude Code, Cursor) connects to it and can manage contacts and send SMS through a messaging provider, with the compliance guardrails a real texting platform needs enforced **on the server, not left to the model**.

```
MCP client (Claude / Claude Code / Inspector)
        │  Streamable HTTP, Bearer API key
        ▼
Next.js on Vercel
  /api/mcp                → MCP tools (mcp-handler)
  /api/webhooks/inbound   → inbound SMS (STOP/START/HELP, replies)
  /api/webhooks/status    → delivery status callbacks
  /admin (optional)       → read-only view of contacts, messages, audit log
        │
        ├── Supabase Postgres: contacts, tags, consent/opt-outs, messages, broadcasts, api_keys, audit_log
        └── MessagingProvider interface
              ├── MockProvider (default in tests and local dev)
              └── TwilioProvider (sandbox-routed to the Twilio Virtual Phone)
```

## 3. Stack and versions

- Next.js (App Router), TypeScript strict mode, Node 20+.
- `mcp-handler` v2 with `@modelcontextprotocol/server` v2 and `zod` v4. **Check the current mcp-handler README before writing the route**; v2 is a different API from v1 / `@vercel/mcp-adapter`, and most blog posts show v1. Pin whatever versions you install.
- Supabase: hosted free project plus the Supabase CLI, with schema changes as SQL migrations in `supabase/migrations/`. Use `@supabase/supabase-js` server-side only.
- Twilio Node SDK for the real provider.
- Vitest for tests. ESLint + Prettier.
- MCP Inspector (`npx @modelcontextprotocol/inspector@latest`) for manual testing.

## 4. Data model (first migration)

Keep it small. Every table gets `id uuid`, `created_at`, and RLS enabled with **no** anon policies (all access goes through server code using the service role key).

- `contacts`: `first_name`, `last_name`, `phone_e164` (unique), `timezone` (IANA, nullable), `source`, `custom_fields jsonb`.
- `tags` and `contact_tags` (many-to-many).
- `consent_events`: `contact_id`, `type` (`opt_in` | `opt_out`), `channel` (`sms_keyword` | `import` | `manual`), `raw_body`, `received_at`. A contact's current status is the latest event; add a view `contact_consent_status`.
- `messages`: `contact_id`, `direction` (`outbound` | `inbound`), `body`, `provider`, `provider_message_id`, `status`, `error_code`, `broadcast_id` (nullable), `sandbox_redirected_to` (nullable).
- `broadcasts`: `name`, `body_template`, `tag_filter`, `status` (`draft` | `previewed` | `confirmed` | `sending` | `done`), `preview_count`, `confirm_token_hash`, `sent_count`, `skipped_count`.
- `api_keys`: `name`, `key_hash` (store hashes only), `last_used_at`, `revoked_at`.
- `audit_log`: `api_key_id`, `tool_name`, `args_redacted jsonb`, `result_summary`, `ok boolean`.

Seed script: about 25 fictional contacts across 3 tags (`volunteers`, `donors`, `members`), 2 already opted out, a few missing timezones. Phone numbers must be obviously fake (the 555-01XX range) because sandbox routing (below) means nothing reaches them anyway.

## 5. Provider interface

```ts
interface MessagingProvider {
  name: string;
  send(input: { to: string; from: string; body: string; statusCallbackUrl?: string }):
    Promise<{ providerMessageId: string; status: string }>;
  getStatus(providerMessageId: string): Promise<{ status: string; errorCode?: string }>;
}
```

- `MockProvider`: deterministic, records sends in memory, can be told to fail.
- `TwilioProvider`: Messaging API via the Node SDK. Credentials from env (`TWILIO_ACCOUNT_SID`, an **API key SID + secret** rather than the auth token, `TWILIO_FROM_NUMBER`).
- **Sandbox routing**: when `SANDBOX_MODE=true` (the default; also forced on in preview deployments), every outbound send goes to the Twilio Virtual Phone (+1 877 780 4236) instead of the contact's number, and the real intended recipient is stored in the message row. Sending to the Virtual Phone needs no toll-free verification or A2P 10DLC registration, so a trial account works. Never write code that can text a real person unless `SANDBOX_MODE=false` is set explicitly.
- Leave a short `docs/adding-a-provider.md` that explains how a second provider (any texting platform's REST API) would plug in. Don't build one.

## 6. MCP tools

Write tool descriptions for a model reading them cold: say what the tool does, when to use it, what it refuses to do, and what to call next. Use zod schemas with `.describe()` on every field. Return structured content plus a short text summary. Errors come back as tool errors with a plain explanation the model can act on, never a stack trace.

Read tools:
1. `search_contacts`: by name, phone, tag, or consent status; paginated (limit + cursor).
2. `get_contact`: one contact with tags, consent status, and the last 10 messages.
3. `get_conversation`: the full message thread for a contact.
4. `list_opt_outs`: opted-out contacts with when and how.
5. `get_message_status`: by message id; refresh from the provider if not final.

Write tools:
6. `upsert_contact`: create or update by phone; normalizes to E.164; rejects invalid numbers.
7. `tag_contacts`: add or remove a tag for a list of contact ids.
8. `import_contacts_csv`: takes CSV text (cap at 5,000 rows). Validates every row, normalizes phones, de-dupes, and returns a report (inserted, updated, rejected with reasons). Supports `dry_run: true` and defaults to it. **Doesn't create opt-in consent**; consent from an import is only recorded if a `consent` column says so.

Send tools (all guardrails in server code):
9. `send_message`: one contact. Refuses when the contact is opted out, the body is empty or over 1,600 chars, or the contact's local time is outside the allowed sending window (default 8:00 to 21:00 in the contact's timezone; if timezone is unknown, refuse and say why). Appends opt-out language ("Reply STOP to opt out") on the first message to a contact if it isn't already in the body.
10. `preview_broadcast`: takes a name, a body template with `{{first_name}}`-style fields, and a tag filter. Returns the audience count, how many will be skipped and why (opted out, outside window, missing timezone, missing merge field), 3 rendered samples, and a one-time `confirm_token`. Sends nothing.
11. `send_broadcast`: requires `broadcast_id` and the `confirm_token` from the preview, and refuses if the audience changed since the preview. Hard cap of 50 recipients per broadcast in this project. Sends in a loop with a small delay and records each result; one failed send doesn't stop the rest.

The point of 10 + 11 is a two-step, human-in-the-loop send. The model can draft and preview freely, but a send needs the token, and the token only comes from a preview the user saw.

Also expose one MCP **resource**, `outreach://compliance-rules`, a short markdown file describing the guardrails above, so a client model can read the rules instead of guessing.

## 7. Webhooks

- `POST /api/webhooks/inbound`: validate the `X-Twilio-Signature` header first and return 403 on failure. The signature is computed over the exact public URL Twilio called, so behind Vercel use the configured public base URL (`PUBLIC_BASE_URL`), not `req.url`, and log the URL used when validation fails. That mismatch is the classic bug; I've debugged it many times for customers and want the fix documented in the README.
  - Keyword handling (case-insensitive, trimmed): `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` → opt-out event + confirmation reply. `START`, `UNSTOP` → opt-in event. `HELP` → help reply. Anything else → stored as an inbound message.
  - Reply with TwiML or an empty response; never throw a 500 at Twilio.
- `POST /api/webhooks/status`: same signature check; update `messages.status` and `error_code`. Idempotent (status callbacks can arrive more than once and out of order, so don't move a message backward from `delivered` to `sent`).
- Check in the Twilio console whether replies typed into the Virtual Phone reach the number's inbound webhook. If they don't, add a test script that posts a correctly signed fake inbound request.

## 8. Auth, secrets, logging

- MCP requests need `Authorization: Bearer <key>`. Keys are generated by a CLI script (`npm run key:create -- --name "claude-desktop"`), shown once, and stored hashed. Use mcp-handler's auth wrapper if v2 has one; otherwise check the header in the route.
- The Supabase service role key and Twilio credentials live only in server env vars. Nothing secret goes to the client bundle, logs, tool results, or the audit log. Mask phone numbers in logs (`+1555***0142`).
- Every tool call writes an `audit_log` row (redacted args, ok/error, summary).
- Rate-limit send tools per API key (simple Postgres counter is fine).
- `.env.example` with every variable and a comment; `.env*` in `.gitignore` from the first commit.

## 9. How to work (this part matters as much as the code)

- Public GitHub repo. `main` is always deployable.
- One small branch and PR per change, each with a description of what changed and how it was tested. I review and merge every PR myself. No direct commits to `main` after Milestone 0.
- Group the milestones below into weekly "releases": cut a `release/YYYY-MM-DD` integration branch, merge that week's PRs into it, deploy its preview, then merge to `main` and tag it. (This mirrors the posting's "weekly releases, small pull requests, one integration branch per release.")
- Where milestones have independent pieces (for example the Twilio provider, the webhook routes, and the read tools in Milestone 2 to 4), offer to run them in parallel in separate git worktrees or subagents, each on its own branch. Tell me what each one is doing and give me one PR per track.
- Tests: unit tests for guardrails (opt-out, sending window, token check, audience change, recipient cap), the keyword parser, phone normalization, CSV import, and signature validation. Tests run in CI (GitHub Actions) on every PR.
- Stop and ask before: adding a dependency not listed here, changing the schema outside a migration, turning sandbox mode off anywhere, or anything that touches real phone numbers.

## 10. Milestones

**M0: Skeleton.** create-next-app (TypeScript, App Router, ESLint), Vitest, Prettier, GitHub Actions CI, `.env.example`, README stub, this file kept as `BUILD-BRIEF.md`. Supabase CLI linked to a new project.
*Done when:* CI passes on an empty test and the app runs locally.

**M1: Data.** First migration (section 4), RLS on, seed script, typed data-access layer.
*Done when:* `supabase db reset` + seed produces the 25 contacts, and a test reads consent status correctly for an opted-out contact.

**M2: MCP read tools.** `/api/mcp` route with tools 1 to 5 and the compliance resource, Bearer key auth, audit logging.
*Done when:* MCP Inspector connects to `localhost:3000/api/mcp` with a key, lists tools, and `search_contacts` returns seeded data. Requests without a key get 401.

**M3: Writes and import.** Tools 6 to 8 with the MockProvider in place.
*Done when:* a CSV with good rows, bad phones, duplicates and a missing column produces the right report in dry run, then imports correctly.

**M4: Sending with guardrails.** Provider interface, MockProvider, TwilioProvider with sandbox routing, tools 9 to 11.
*Done when:* every refusal case has a passing test, and a real `send_message` lands in the Twilio Virtual Phone inbox.

**M5: Webhooks.** Inbound and status routes with signature validation, keyword handling, idempotent status updates. Deploy to Vercel (sandbox mode forced on) so Twilio can reach the webhooks.
*Done when:* replying STOP (from the Virtual Phone or the signed test script) opts the contact out, and a later `send_message` to them is refused with a clear reason.

**M6: Connect real clients.** Connect the deployed server to Claude Code (`claude mcp add --transport http ...`) and to Claude as a custom connector. Write `docs/demo-script.md`: a 5-minute walkthrough (import a CSV, tag volunteers, preview a broadcast, see the skips, confirm, watch delivery statuses, reply STOP, watch the next send get refused).
*Done when:* I can run the demo start to finish from Claude without touching the database.

**M7 (stretch): Evals.** A small script that runs about 15 scripted user requests through Claude with this MCP server attached and checks behavior: never calls `send_broadcast` without a fresh preview, picks the right tool, reports skip reasons accurately, doesn't try to message opted-out contacts. Score and save results as JSON (same pattern as my triage app). This is the part that connects to my evals background.

## 11. README must cover

What it is (two sentences) and the architecture diagram. Setup from zero (Supabase, Twilio trial + Virtual Phone, Vercel, env vars), how to connect from Claude / Claude Code / Cursor / Inspector, the guardrails and why they're server-side, the signature-validation URL pitfall, what sandbox mode does, and known limitations. Plain language, no marketing words.

## 12. What I'll be able to say when it's done (only after it's built and working)

- Built and deployed a remote MCP server in Next.js on Vercel with Supabase Postgres (migrations, RLS), exposing contact, consent, and SMS tools over a provider interface with a Twilio adapter.
- Enforced texting compliance rules (opt-out keywords, sending windows, two-step broadcast confirmation) on the server so an AI client can't bypass them.
- Shipped it through small PRs and weekly release branches with CI.
- If M7 is done: evaluated how a model uses the tools against scripted scenarios.

Don't add any of these to a resume until the matching milestone is merged and the demo runs.
