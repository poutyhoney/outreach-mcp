# M1: Data

## Card

| Field       | Value                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Audience    | Hiring panel (Solutions Engineer role)                                                                                     |
| Length      | 4 minutes                                                                                                                  |
| PRs         | #2 to #5                                                                                                                   |
| Done when   | "`supabase db reset` + seed produces the 25 contacts, and a test reads consent status correctly for an opted-out contact." |
| Video       | Not recorded                                                                                                               |
| Recorded on |                                                                                                                            |

## The one thing to remember

Consent is stored as a history of events, and the current status is the latest one. The server can
always answer "who opted out, when, and how."

## Before you record

- [ ] Docker Desktop running.
- [ ] Tab 1 (repo root): `nvm use && npx supabase start`. It prints the Studio URL
      (http://127.0.0.1:54323).
- [ ] Tab 2 (repo root): `nvm use`.
- [ ] Editor open on `supabase/migrations/20261113064140_init_schema.sql`.
- [ ] Browser: Supabase Studio, Table Editor.

## Scenes

### 1. Hook (0:00 to 0:30)

**On screen:** the migration file, scrolled to `consent_events`.

**Say:** On a texting platform, the worst bug is texting someone who said STOP. So consent isn't a
yes/no column. It's a log of events, and the latest event wins.

### 2. The schema (0:30 to 1:30)

**On screen:** the migration file.

**Do:** scroll through `contacts`, `consent_events`, the `contact_consent_status` view, and the
`enable row level security` lines.

**Say:** Every table has row-level security on and no public policies. The browser can't read
anything. All access goes through server code with the service role key. Schema changes only
happen in migrations like this one, so every environment is built the same way.

### 3. Reset and seed (1:30 to 2:15)

**On screen:** tab 2.

**Do:**

```bash
npx supabase db reset
```

Then in Studio, open `contacts` and point at the row count.

**Say:** One command rebuilds the database from the migrations and loads 25 fictional contacts. The
numbers are all in the 555-01XX range, so nothing could ever reach a real person.

**Expect:** 25 rows in `contacts`.

### 4. Consent status (2:15 to 3:15)

**On screen:** Studio, the `contacts_with_consent` view, filtered to `consent_status = opt_out`.
Then tab 2.

**Do:** show Jonah Pierce (replied STOP) and Felix Moreau (replied "unsubscribe"). Then run:

```bash
npm run test:db
```

**Say:** Both opted in 30 days ago and opted out three days ago. The view returns the latest event,
so they show as opted out. The database tests check exactly that, and they run in CI against a
local Supabase stack on every PR.

**Expect:** all DB test files pass. `consent-status.test.ts` is the M1 one.

### 5. Close (3:15 to 4:00)

**On screen:** PRs #2 to #5.

**Say:** Four small PRs: schema, seed, the typed data layer, and the test with its CI job. Next,
the MCP server that lets an AI client read this data.

## If something goes wrong

- **`supabase start` hangs or fails:** Docker isn't running. Start Docker Desktop and retry.
- **`test:db` refuses to run:** it only runs against localhost. Check that `.env.local` points at
  `http://127.0.0.1:54321`.

## Reset after recording

Nothing to reset. `db reset` already left the seed data in place. It also deletes API keys, so
make a new one before recording M2.
