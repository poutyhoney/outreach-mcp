import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MAX_IMPORT_ROWS, prepareImport } from "@/lib/contacts/import";
import { getDb } from "@/lib/db/client";
import { type ImportReport, importContacts } from "@/lib/db/contacts";
import { withAudit } from "@/lib/mcp/audit";
import { toolError, toolResult } from "@/lib/mcp/results";

// The result lists at most this many rejected rows; rejectedCount has the total.
const MAX_REJECTED_SHOWN = 100;
const NO_DATABASE_CHANGES: ImportReport = {
  inserted: 0,
  updated: 0,
  consentRecorded: 0,
  optInBlocked: [],
};

const importContactsCsvInput = z.object({
  csv: z
    .string()
    .min(1)
    .max(2_000_000)
    .describe(
      "The whole CSV file as text, header row first. Columns: phone (required), first_name, " +
        "last_name, timezone (IANA, e.g. America/Chicago), tags (separated by ;), consent (yes or no). " +
        "Any other column becomes a custom field.",
    ),
  dry_run: z
    .boolean()
    .default(true)
    .describe("true (the default) checks the file and reports without saving. false imports it."),
});

export function registerImportTools(server: McpServer): void {
  server.registerTool(
    "import_contacts_csv",
    {
      title: "Import contacts from CSV",
      description:
        `Import up to ${MAX_IMPORT_ROWS} contacts from CSV text. Every row is checked: phones are normalized ` +
        "to E.164, and rows with a bad phone, a bad timezone, a missing field, or a phone already used " +
        "earlier in the file are rejected with the line number and a reason. Good rows create new contacts " +
        "or update existing ones by phone; blank cells keep the stored value. " +
        "Runs as a dry run unless dry_run is false: always do a dry run first, show the user the report, " +
        "and import only after they agree. " +
        "An import does not create consent. Consent is recorded only from a consent column, and an import " +
        "never opts back in a contact who opted out (those are listed in optInBlocked).",
      inputSchema: importContactsCsvInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    withAudit("import_contacts_csv", async (args) => {
      const prepared = prepareImport(args.csv);
      if (!prepared.ok) {
        return toolError(`${prepared.reason} Nothing was imported.`);
      }
      const { rows, rejected, dataRows, customFieldColumns, ignoredColumns } = prepared.value;

      // Skip the database when no row survived the checks.
      const db =
        rows.length > 0
          ? await importContacts(getDb(), rows, { source: "csv_import", dryRun: args.dry_run })
          : NO_DATABASE_CHANGES;

      const blocked = db.optInBlocked.length
        ? ` ${db.optInBlocked.length} opt-in(s) skipped because the contact opted out.`
        : "";
      const summary = args.dry_run
        ? `Dry run, nothing saved. ${dataRows} row(s): would insert ${db.inserted}, update ${db.updated}, ` +
          `reject ${rejected.length}.${blocked} Show the user this report; to import, call again with dry_run: false.`
        : `Imported ${dataRows} row(s): inserted ${db.inserted}, updated ${db.updated}, ` +
          `rejected ${rejected.length}.${blocked}`;

      return toolResult(summary, {
        dryRun: args.dry_run,
        dataRows,
        validRows: rows.length,
        ...db,
        rejectedCount: rejected.length,
        rejected: rejected.slice(0, MAX_REJECTED_SHOWN),
        customFieldColumns,
        ignoredColumns,
      });
    }),
  );
}
