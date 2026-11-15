// Turns CSV text into rows that are safe to pass to importContacts, plus a list
// of rejected rows with reasons. Pure: no database, so every rule here has a
// unit test. The import_contacts_csv tool calls this, then the database.
import type { ContactImportRow } from "@/lib/db/contacts";
import { parseCsv } from "./csv";
import {
  type Checked,
  CUSTOM_FIELD_KEY_PATTERN,
  normalizePhone,
  normalizeTag,
  normalizeTimezone,
} from "./validate";

export const MAX_IMPORT_ROWS = 5000;
const MAX_NAME_LENGTH = 100;
const MAX_CUSTOM_VALUE_LENGTH = 500;

export type RejectedRow = { line: number; phone: string; reason: string };

export type PreparedImport = {
  rows: ContactImportRow[];
  rejected: RejectedRow[];
  dataRows: number;
  customFieldColumns: string[];
  ignoredColumns: string[];
};

// Header names people actually use, mapped to ours. Headers are lowercased and
// spaces or hyphens become underscores before this lookup ("First Name" -> first_name).
const COLUMN_ALIASES: Record<string, string> = {
  phone_number: "phone",
  phone_e164: "phone",
  mobile: "phone",
  cell: "phone",
  firstname: "first_name",
  first: "first_name",
  lastname: "last_name",
  last: "last_name",
  tz: "timezone",
  time_zone: "timezone",
  tag: "tags",
};
const KNOWN_COLUMNS = new Set(["phone", "first_name", "last_name", "timezone", "tags", "consent"]);

const OPT_IN_WORDS = new Set(["yes", "y", "true", "1", "opt_in", "opted_in", "subscribed"]);
const OPT_OUT_WORDS = new Set(["no", "n", "false", "0", "opt_out", "opted_out", "unsubscribed"]);

function normalizeHeader(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return COLUMN_ALIASES[key] ?? key;
}

// Checks every data row. A problem with the whole file (no phone column, too
// many rows, a broken quote) fails the whole import. A problem with one row
// rejects that row and the rest still go in.
export function prepareImport(csvText: string): Checked<PreparedImport> {
  const parsed = parseCsv(csvText);
  if (!parsed.ok) {
    return parsed;
  }
  const [header, ...records] = parsed.value;
  if (!header) {
    return { ok: false, reason: "The CSV is empty." };
  }
  if (records.length === 0) {
    return { ok: false, reason: "The CSV has a header row but no data rows." };
  }
  if (records.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      reason: `The CSV has ${records.length} data rows. The limit is ${MAX_IMPORT_ROWS}; split the file.`,
    };
  }

  const columns = header.fields.map(normalizeHeader);
  const repeated = columns.find((name, i) => name !== "" && columns.indexOf(name) !== i);
  if (repeated) {
    return { ok: false, reason: `The header has the column "${repeated}" more than once.` };
  }
  if (!columns.includes("phone")) {
    return {
      ok: false,
      reason: `The CSV has no phone column. Found: ${header.fields.join(", ")}. Add a column named "phone".`,
    };
  }

  const customFieldColumns = columns.filter(
    (name) => !KNOWN_COLUMNS.has(name) && CUSTOM_FIELD_KEY_PATTERN.test(name),
  );
  const ignoredColumns = header.fields.filter((_, i) => {
    const name = columns[i];
    return !KNOWN_COLUMNS.has(name) && !CUSTOM_FIELD_KEY_PATTERN.test(name);
  });

  const rows: ContactImportRow[] = [];
  const rejected: RejectedRow[] = [];
  const firstLineForPhone = new Map<string, number>();

  for (const record of records) {
    // Look up a field by column name, trimmed. "" when the column is absent.
    const field = (name: string) => record.fields[columns.indexOf(name)]?.trim() ?? "";
    const rawPhone = field("phone");
    const reject = (reason: string) =>
      rejected.push({ line: record.line, phone: rawPhone, reason });

    if (record.fields.length !== columns.length) {
      reject(`Has ${record.fields.length} fields; the header has ${columns.length}.`);
      continue;
    }
    const result = checkRow(field, customFieldColumns);
    if (!result.ok) {
      reject(result.reason);
      continue;
    }

    const earlier = firstLineForPhone.get(result.value.phone_e164);
    if (earlier !== undefined) {
      reject(`Same phone as line ${earlier}. Only the first row for a phone is imported.`);
      continue;
    }
    firstLineForPhone.set(result.value.phone_e164, record.line);
    rows.push(result.value);
  }

  return {
    ok: true,
    value: { rows, rejected, dataRows: records.length, customFieldColumns, ignoredColumns },
  };
}

// Checks one row's values. Blank optional fields are left out of the result,
// which tells the database to keep what's stored.
function checkRow(
  field: (name: string) => string,
  customFieldColumns: string[],
): Checked<ContactImportRow> {
  const phone = normalizePhone(field("phone"));
  if (!phone.ok) {
    return phone;
  }
  const row: ContactImportRow = { phone_e164: phone.value };

  for (const name of ["first_name", "last_name"] as const) {
    const value = field(name);
    if (value.length > MAX_NAME_LENGTH) {
      return { ok: false, reason: `${name} is longer than ${MAX_NAME_LENGTH} characters.` };
    }
    if (value) row[name] = value;
  }

  if (field("timezone")) {
    const timezone = normalizeTimezone(field("timezone"));
    if (!timezone.ok) {
      return timezone;
    }
    row.timezone = timezone.value;
  }

  // Tags are separated by semicolons, because commas already separate columns.
  const tags: string[] = [];
  for (const raw of field("tags").split(";")) {
    if (!raw.trim()) continue;
    const tag = normalizeTag(raw);
    if (!tag.ok) {
      return tag;
    }
    if (!tags.includes(tag.value)) tags.push(tag.value);
  }
  if (tags.length) row.tags = tags;

  const consent = field("consent").toLowerCase();
  if (OPT_IN_WORDS.has(consent)) {
    row.consent = "opt_in";
  } else if (OPT_OUT_WORDS.has(consent)) {
    row.consent = "opt_out";
  } else if (consent) {
    return { ok: false, reason: `consent "${field("consent")}" must be yes or no (or blank).` };
  }

  const custom: Record<string, string> = {};
  for (const name of customFieldColumns) {
    const value = field(name);
    if (value.length > MAX_CUSTOM_VALUE_LENGTH) {
      return { ok: false, reason: `${name} is longer than ${MAX_CUSTOM_VALUE_LENGTH} characters.` };
    }
    if (value) custom[name] = value;
  }
  if (Object.keys(custom).length) row.custom_fields = custom;

  return { ok: true, value: row };
}
