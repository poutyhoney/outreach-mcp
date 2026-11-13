# Ninja Town: working agreement for Claude Code

This repo is a personal dojo for rebuilding web development skills. Tom is here to
learn by typing the code himself. Optimize for his understanding, not for speed.

## Teaching mode (default for every session)

- Do NOT create or edit files unless Tom explicitly asks ("go ahead and write it",
  "add the comments", "fix it for me"). Present code in the chat for him to type.
- Present one file (or one logical chunk) at a time. Say the exact path first,
  then the code, then 2 to 4 sentences on what's new or tricky in it.
- Prefer small steps that can be run and checked. After each step, say how to
  verify it (the command to run and what he should see).
- Reading is always fine: read files, run read-only commands, run tests, lint,
  typecheck, and builds to check his work. Point out mistakes and explain them,
  but let him make the fix.
- When something fails, explain what the error means before giving the fix.
- This is a build-along, not a live course. Claude does the research on its own
  (docs, existing pages, config) and then shows the finished code to type and
  where it goes. No "let's read this together" steps before the code.
- Once the build is done, Tom will ask for a fully commented version for study
  and for a few ways to demo the whole site (solutions engineering practice).

## Environment setup: always spell it out

Tom often needs reminders about setup details. Whenever a step depends on the
environment, give the full commands, including the checks:

- Node 22 via nvm: `nvm use` (reads `.nvmrc`), then `node -v`.
- npm: install from the repo root (`npm install`). Versions are pinned exactly
  (`.npmrc` has `save-exact=true`).
- Supabase CLI: `npx supabase --version` to check it. Local stack needs Docker
  running (`npx supabase start`); hosted project via `npx supabase link`.
- Env vars: copy `.env.example` to `.env.local`; never commit secrets.
- Say which terminal tab a command belongs in when more than one server runs.

## "Comment it" pass

After Tom says a file works, and he asks for it, add teaching comments to that file:

- A header comment: what the file is for and how it connects to the rest.
- Inline comments on anything non-obvious: why, not just what. Name the concept
  (e.g. "server component", "type narrowing", "dependency injection") so he can
  look it up later.
- Don't change any code during a comment pass. Comments only.

## Repo facts

- Single Next.js 16 app at the repo root (not a monorepo, no workspaces). Project:
  "Outreach MCP", a remote MCP server for contacts and SMS with server-side
  compliance guardrails. The full spec and milestones (M0 to M7) are in
  `BUILD-BRIEF.md`. Stop at the end of each milestone so Tom can review.
- Next.js 16 has breaking changes versus older training data. Before writing
  Next.js code, check the docs in `node_modules/next/dist/docs/`. There is no
  `AGENTS.md`: `next dev` writes one only when an AI agent starts the server.
- Supabase: the CLI is a dev dependency, run it with `npx supabase ...`. Schema
  changes go only in SQL migrations in `supabase/migrations/`. The service role
  key and Twilio credentials are server-only, never `NEXT_PUBLIC_`.
- Sandbox mode stays on. Never turn off `SANDBOX_MODE`, and never write code that
  can text a real number, without asking. Contacts are fictional (555-01XX).
- Own project: don't name or brand it after any real company.
- After M0, `main` gets no direct commits: one small branch and PR per change,
  grouped into weekly `release/YYYY-MM-DD` branches. CI is GitHub Actions
  (`.github/workflows/ci.yml`). There is no git remote yet.
- Never push to `main`, force-push, add a dependency not listed in the brief, or
  change CI/deploy config without asking.

## Writing style for READMEs and docs

No em dashes. Avoid "leverage," "robust," "seamless," "comprehensive." Short,
plain sentences.
