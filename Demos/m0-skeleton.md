# M0: Skeleton

## Card

| Field       | Value                                                  |
| ----------- | ------------------------------------------------------ |
| Audience    | Hiring panel (Solutions Engineer role)                 |
| Length      | 3 minutes                                              |
| PRs         | Direct commits on `main`, then cleanup in #1           |
| Done when   | "CI passes on an empty test and the app runs locally." |
| Video       | Not recorded                                           |
| Recorded on |                                                        |

## The one thing to remember

Before any feature, the project had the same checks a team relies on: format, lint, types, tests,
and a build, run on every PR.

## Before you record

- [ ] Tab 1 (repo root): `nvm use`, then `node -v` prints v22.
- [ ] Browser tab A: the repo on GitHub, `README.md` showing.
- [ ] Browser tab B: the Actions tab, filtered to `main`.
- [ ] Editor open on `BUILD-BRIEF.md`, section 10.

## Scenes

### 1. Hook (0:00 to 0:30)

**On screen:** the README's opening paragraph and architecture diagram.

**Say:** This is a remote MCP server that lets an AI client manage contacts and send texts. The
compliance rules a texting platform needs live in server code, so the model can't skip them.
This first video is the foundation.

### 2. The plan (0:30 to 1:00)

**On screen:** `BUILD-BRIEF.md`, the milestone list.

**Say:** The work is split into eight milestones. Each ends with a "done when" check, and I stop
there to review. Changes ship as small PRs grouped into a weekly release branch.

### 3. The checks (1:00 to 2:00)

**On screen:** tab 1.

**Do:** run the same checks CI runs.

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

**Say:** Five checks: Prettier, ESLint, TypeScript in strict mode, Vitest, and a production build.
Versions are pinned exactly, so CI and my laptop install the same thing.

**Expect:** each step passes. The build ends with a route table.

### 4. CI (2:00 to 2:40)

**On screen:** browser tab B. Open the most recent green run and expand the steps.

**Say:** The same checks run on GitHub for every PR and every push to `main` or a release branch.
Nothing merges red. The job only gets read access to the repo.

### 5. Close (2:40 to 3:00)

**On screen:** the repo's closed PR list.

**Say:** That's the skeleton. Next is the data model: contacts, consent as events, and row-level
security, all as SQL migrations.

## If something goes wrong

- **`node -v` prints the wrong version:** run `nvm use` in that tab again.
- **The build is slow on camera:** run it once before recording so the cache is warm.

## Reset after recording

Nothing to reset.
