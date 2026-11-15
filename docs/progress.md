# Progress and decisions

Where the build stands, and what was decided along the way that the brief doesn't say. Update this
at the end of each milestone. A new chat should read it together with `BUILD-BRIEF.md`.

Last updated: 2026-11-14, after M2.

## Where things stand

| Milestone             | State       | PRs                                     |
| --------------------- | ----------- | --------------------------------------- |
| M0: Skeleton          | Done        | Direct commits on `main`, cleanup in #1 |
| M1: Data              | Done        | #2 to 5                                 |
| M2: MCP read tools    | Done        | #9 to 13                                |
| M3: Writes and import | Next        |                                         |
| M4: Sending           | Not started |                                         |
| M5: Webhooks          | Not started |                                         |
| M6: Real clients      | Not started |                                         |
| M7: Evals (stretch)   | Not started |                                         |

Chores: #6 and #8. #7 merged `release/2026-11-12` into `main` once, after M1.

## Branches and releases

- Current release branch: `release/2026-11-12`. Feature PRs target it, not `main`.
- Thursday 2026-11-19: open a PR from `release/2026-11-12` to `main` (merge commit, keep the
  branch), tag `v0.1.0` (annotated), then cut `release/2026-11-19` from `main`. Later PRs target
  the new branch. No tags exist yet.
- Branch names: `m<N>/<short-topic>`, for example `m2/tools-messages`. One small PR per change.
- Before starting the next step, confirm a PR really merged:
  `gh pr view <N> --json state --jq .state` should print `MERGED`.

## What exists now

- **Schema** (`supabase/migrations/`): the M1 tables from brief section 4, the
  `contact_consent_status` view, and `contacts_with_consent` (contacts joined to their current
  consent). The second view exists because PostgREST can't embed a view that has no foreign keys,
  so `search_contacts` queries `contacts_with_consent` directly.
- **Auth** (`src/lib/auth/api-keys.ts`): keys look like `omcp_...`, are stored as sha256 hashes,
  and are created with `npm run key:create -- --name "..."`. The route uses `withMcpAuth` from
  mcp-handler, so a missing or bad key gets a 401.
- **MCP route** (`src/app/api/mcp/route.ts`): registers tools from `src/lib/mcp/tools/` and the
  `outreach://compliance-rules` resource (`src/lib/mcp/compliance-rules.ts`).
- **Read tools**: `search_contacts`, `get_contact`, `get_conversation`, `list_opt_outs`,
  `get_message_status`.
- **Shared helpers**:
  - `withAudit` (`src/lib/mcp/audit.ts`) wraps every tool handler and writes an `audit_log` row.
  - `redact.ts` masks phones and redacts args.
  - `toolResult` and `toolError` (`src/lib/mcp/results.ts`) return structured content plus a text
    summary.
  - `contactLookupInput`, `parseContactLookup` and `displayName` (`src/lib/mcp/tools/contacts.ts`)
    are shared by tools that take `contact_id` or `phone`.
- **Pagination**: keyset on `id`, fetching `limit + 1` rows to know whether there's a next page.

## Decisions and open items

- **M4: provider refresh.** `get_message_status` returns the stored status for now. See the
  `TODO(M4)` in `src/lib/mcp/tools/messages.ts`.
- **M4: audit gap.** Input that fails zod validation is rejected by the SDK before `withAudit`
  runs, so it gets no audit row. Fine for reads. For send tools, log those too.
- **M6: OAuth.** Claude custom connectors expect OAuth. This server uses Bearer keys, which work
  for Claude Code and Inspector. Decide how to handle it when M6 starts.
- **ESLint stays at 9.39.5** until `eslint-plugin-react` allows ESLint 10. The deprecation warning
  in CI logs is expected.
- **`npm audit` warning**: a moderate `minimatch` advisory comes from ESLint tooling. Leave it.

## Local workflow

Use two terminal tabs.

Tab 1, the app:

```bash
nvm use && npx supabase start && npm run dev
```

Tab 2, checks and tools:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:db
```

`npm run test:db` needs the local Supabase stack running. It refuses to run against anything but
localhost. After `npx supabase db reset`, the seed has 25 contacts and no messages.

Connect MCP Inspector (2.15.0) in tab 2. Load the key without echoing it, then start Inspector:

```bash
read -rs "OMCP_KEY?Paste your API key: "
```

```bash
npx @modelcontextprotocol/inspector@2.15.0 --transport http --server-url http://localhost:3000/api/mcp --header "Authorization: Bearer $OMCP_KEY"
```

Inspector's UI opens on port 6274. The MCP server is the Next app on port 3000. Flip the card's
toggle to connect.
