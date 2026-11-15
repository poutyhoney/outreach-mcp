# M2: MCP read tools

## Card

| Field       | Value                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience    | Hiring panel (Solutions Engineer role)                                                                                                                   |
| Length      | 5 minutes                                                                                                                                                |
| PRs         | #9 to #13                                                                                                                                                |
| Done when   | "MCP Inspector connects to `localhost:3000/api/mcp` with a key, lists tools, and `search_contacts` returns seeded data. Requests without a key get 401." |
| Video       | Not recorded                                                                                                                                             |
| Recorded on |                                                                                                                                                          |

## The one thing to remember

An AI client can read contacts and consent through tools that are locked behind an API key, and
every call is written to an audit log.

## Before you record

- [ ] Docker Desktop running. `node -v` prints v22.23 or later (Inspector needs it).
- [ ] Tab 1 (repo root): `nvm use && npx supabase start && npm run dev`.
- [ ] Tab 2 (repo root): `nvm use`, then `npm run key:create -- --name "demo"`. Copy the key
      **off camera**.
- [ ] Tab 2: load the key without printing it, then start Inspector (commands in
      `docs/progress.md`, "Local workflow").
- [ ] Browser: Inspector on port 6274, not yet connected. Second tab: Studio, `audit_log` table.

## Scenes

### 1. Hook (0:00 to 0:30)

**On screen:** Inspector, disconnected.

**Say:** MCP is how an AI client like Claude calls tools on a server. This milestone adds the
server's read tools. A model can look up contacts and consent, but only with a key, and every call
leaves a record.

### 2. No key, no access (0:30 to 1:15)

**On screen:** a third terminal tab (tab 3).

**Do:**

```bash
curl -i -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" -d '{}'
```

**Say:** Without a key, the server answers 401 before any tool code runs. Keys are shown once when
created and stored only as hashes.

**Expect:** `HTTP/1.1 401`.

### 3. Connect and list (1:15 to 2:00)

**On screen:** Inspector.

**Do:** flip the toggle to connect. Open Tools, then List Tools. Open Resources and read
`outreach://compliance-rules`.

**Say:** Five read tools, plus the write tools from M3. The compliance rules are a resource, so a
model can read the rules instead of guessing them.

### 4. Search and look up (2:00 to 3:30)

**On screen:** Inspector, Tools.

**Do:** run `search_contacts` with tag `volunteers`. Then run `get_contact` for Jonah Pierce
(phone `+13125550112`).

**Say:** Search is paginated, so a model can't pull the whole list in one call. `get_contact` shows
Jonah is opted out, when, and the word he texted. The tool descriptions tell the model what each
tool is for and what to call next.

**Expect:** a list of volunteers with a cursor. Jonah's consent status is `opt_out`.

### 5. The audit log (3:30 to 4:20)

**On screen:** Studio, `audit_log`.

**Do:** refresh and show the newest rows.

**Say:** Every tool call wrote a row: which key, which tool, the arguments with phone numbers
masked, and whether it worked. A support or compliance team can answer "what did the AI do" from
this table.

### 6. Close (4:20 to 5:00)

**On screen:** PRs #9 to #13.

**Say:** Five PRs: keys, the route, the audit wrapper, and two sets of tools. Next, the write tools
and a CSV import that won't quietly opt anyone back in.

## If something goes wrong

- **Inspector UI fails with `reading 'bind'`:** Node is older than 22.23.4. `nvm install 22`,
  `nvm use`, and restart tabs 1 and 2.
- **401 after connecting, then an OAuth error:** the key was deleted by a `db reset`. Make a new key.
- **Array arguments rejected:** Inspector wants JSON, for example `["volunteers"]`.

## Reset after recording

Nothing to reset. Audit rows are fine to keep.
