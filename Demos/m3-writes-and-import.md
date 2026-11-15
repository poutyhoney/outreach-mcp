# M3: Writes and import

## Card

| Field       | Value                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Audience    | Hiring panel (Solutions Engineer role)                                                                                            |
| Length      | 5 minutes                                                                                                                         |
| PRs         | #15 to #18                                                                                                                        |
| Done when   | "A CSV with good rows, bad phones, duplicates and a missing column produces the right report in dry run, then imports correctly." |
| Video       | Not recorded                                                                                                                      |
| Recorded on |                                                                                                                                   |

## The one thing to remember

A messy CSV gets a clear report before anything is written, and an import can never opt a person
back in after they texted STOP.

## Before you record

- [ ] Same setup as M2: Supabase and `npm run dev` in tab 1, Inspector connected from tab 2.
- [ ] Editor open on `docs/samples/contacts-import.csv`.
- [ ] Tab 2: put the dry-run arguments on the clipboard (command in `docs/progress.md`, "To send a
      CSV file").
- [ ] Rehearse once and write the real report counts into scene 3's **Expect** line.

## Scenes

### 1. Hook (0:00 to 0:30)

**On screen:** the sample CSV.

**Say:** Customers bring contact lists from spreadsheets, and those lists are messy. Phone numbers
in five formats, duplicates, missing columns, and someone who already opted out. This is what a
real import looks like.

### 2. The messy file (0:30 to 1:15)

**On screen:** the sample CSV.

**Do:** point at each problem row.

**Say:** Different phone formats. A number with no area code. Alma twice. A short row. `EST`
instead of a real timezone. And Jonah, who texted STOP, with "yes" in the consent column.

### 3. Dry run (1:15 to 2:45)

**On screen:** Inspector, `import_contacts_csv`, Edit as JSON.

**Do:** paste the arguments (with `dry_run: true`) and run it.

**Say:** Dry run is the default. Nothing is written. The report says what would be inserted, what
would be updated, and what was rejected, with the line number and the reason. Phones are
normalized to one format. And Jonah lands in `optInBlocked`: a spreadsheet can't override a STOP.
He opts back in only by texting START.

**Expect:** _fill in after rehearsal: inserted, updated, rejected counts and Jonah in
`optInBlocked`._

### 4. Import for real (2:45 to 3:45)

**Do:** change `dry_run` to `false` and run again. Then run `get_contact` for `+13125550131`
(Alma Reyes).

**Say:** Same report, now applied in one database transaction. Either every row lands or none do.
Alma is in, with her tags and her consent recorded from the CSV.

### 5. Single edits (3:45 to 4:20)

**Do:** run `tag_contacts` with Alma's id in `contact_ids` (JSON array), `tag` set to `donors`,
and `action` set to add.

**Say:** The model can also make one-off changes: add or update a contact, add or remove a tag. The
result says what changed, what was already set, and what wasn't found.

### 6. Close (4:20 to 5:00)

**On screen:** PRs #15 to #18.

**Say:** Four PRs: validators with unit tests, the import as one Postgres function, the write
tools, and the CSV tool. Next milestone: actually sending texts, with the guardrails enforced on
the server.

## If something goes wrong

- **Paste lands in the wrong place:** turn on Edit as JSON first, select the whole box, then paste.
- **A real import ran by accident:** use the reset below, then record again.

## Reset after recording

Remove the imported rows so `npm run test:db` still sees 25 contacts. This keeps your API key.
The command is in `docs/progress.md` ("After a real import"). Also remove the `donors` tag you
added to Alma; the delete of her contact row takes care of it.
