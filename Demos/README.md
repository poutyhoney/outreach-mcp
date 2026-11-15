# Demos

One short screen-recorded video per milestone, made for a hiring panel. Each video shows what the
milestone added, why it matters to a texting platform, and that it works.

This folder holds the recording scripts. The videos are hosted elsewhere (YouTube unlisted or
Loom) and linked below. No video files go in the repo.

## Videos

| Milestone             | Script                                             | Video        | Recorded |
| --------------------- | -------------------------------------------------- | ------------ | -------- |
| M0: Skeleton          | [m0-skeleton.md](m0-skeleton.md)                   | Not recorded |          |
| M1: Data              | [m1-data.md](m1-data.md)                           | Not recorded |          |
| M2: MCP read tools    | [m2-mcp-read-tools.md](m2-mcp-read-tools.md)       | Not recorded |          |
| M3: Writes and import | [m3-writes-and-import.md](m3-writes-and-import.md) | Not recorded |          |
| M4: Sending           |                                                    |              |          |
| M5: Webhooks          |                                                    |              |          |
| M6: Real clients      |                                                    |              |          |
| M7: Evals (stretch)   |                                                    |              |          |

When a video is up, replace "Not recorded" with a link and fill in the date.

## Adding a milestone

1. When the milestone's PRs are merged, copy [TEMPLATE.md](TEMPLATE.md) to `m<N>-<topic>.md`.
2. Fill it in from `BUILD-BRIEF.md` (the milestone's "done when" line) and `docs/progress.md`.
3. Rehearse it once against a fresh `npx supabase db reset`. Fix the script where reality differs.
4. Record, upload, and add the link to the table above.

## Recording conventions

- **Length:** 3 to 5 minutes. If a script runs longer, cut scenes, not narration speed.
- **Screen:** 1920x1080. Browser zoom 125%. Terminal font 18pt or larger. Hide the bookmarks bar.
- **Secrets:** never show `.env.local`, an API key, or the Supabase dashboard's keys page. Load the
  MCP key with `read -rs` (see `docs/progress.md`) so it never prints.
- **Data:** only the seeded fictional contacts and `docs/samples/contacts-import.csv`.
- **Sandbox mode:** stays on in every recording.
- **Title:** `Outreach MCP, M<N>: <milestone name>`.
- **Description:** two sentences on what the video shows, then a link to the repo and the PRs.
