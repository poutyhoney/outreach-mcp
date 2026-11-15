# M<N>: <Milestone name>

Copy this file to `m<N>-<topic>.md` when the milestone is merged. Delete the hints in italics.

## Card

| Field       | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| Audience    | Hiring panel (Solutions Engineer role)                       |
| Length      | _target, 3 to 5 minutes_                                     |
| PRs         | _numbers and links_                                          |
| Done when   | _quote the milestone's "done when" line from BUILD-BRIEF.md_ |
| Video       | _link once uploaded_                                         |
| Recorded on | _date_                                                       |

## The one thing to remember

_One sentence the viewer should be able to repeat after watching. Example: "Consent is stored as
events, so the server always knows who opted out and how."_

## Before you record

_Every command needed to get from a cold laptop to the first scene. Say which terminal tab each
one runs in. End with a check that proves the setup is right._

- [ ] Docker Desktop running
- [ ] Tab 1: `nvm use && npx supabase start && npm run dev`
- [ ] _milestone-specific setup_
- [ ] Windows arranged: _which apps, in what order_

## Scenes

_Three to six scenes. Each one has a time budget, what's on screen, what you do, and what you say.
Narration is a guide, not a teleprompter. Say it in your own words._

### 1. Hook (0:00 to 0:30)

**On screen:** _..._

**Do:** _..._

**Say:** _The problem this milestone solves, in terms a texting platform cares about._

### 2. _Scene name_ (0:30 to 1:30)

**On screen:** _..._

**Do:** _..._

**Say:** _..._

**Expect:** _what the viewer should see. If it doesn't happen during rehearsal, fix the script._

### N. Close (last 30 seconds)

**On screen:** the PR list or the CI run for this milestone.

**Say:** what shipped, how it was shipped (small PRs, CI on each), and what the next milestone
adds.

## If something goes wrong

_Likely failures during recording and the quick fix for each._

## Reset after recording

_Commands that put the local data back so tests and the next recording start clean._
