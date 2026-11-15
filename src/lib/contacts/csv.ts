import type { Checked } from "@/lib/contacts/validate";

// One record from the file. `line` is the line it starts on (1-based), so the
// import report can point the user at the right row in their spreadsheet.
export type CsvRow = { line: number; fields: string[] };

// Parses CSV text the way spreadsheets export it (RFC 4180):
// - commas separate fields, and a line break ends a record (\n or \r\n)
// - a field wrapped in double quotes can hold commas and line breaks
// - inside quotes, "" stands for one literal quote
// Blank lines are skipped, and a leading byte order mark (from Excel) is dropped.
// Fields are not trimmed; the caller decides what whitespace means.
export function parseCsv(text: string): Checked<CsvRow[]> {
  const input = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1; // the line we are reading now
  let rowStart = 1; // the line the current record started on

  const endRow = () => {
    fields.push(field);
    // A blank line parses as one empty field. Skip it.
    if (fields.length > 1 || fields[0].trim() !== "") {
      rows.push({ line: rowStart, fields });
    }
    fields = [];
    field = "";
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++; // skip the second quote of the pair
      } else if (char === '"') {
        inQuotes = false;
      } else {
        if (char === "\n") line++;
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++; // \r\n is one line break
      endRow();
      line++;
      rowStart = line;
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    return {
      ok: false,
      reason: `The row starting on line ${rowStart} has a quote (") that is never closed.`,
    };
  }
  // The last record, when the file doesn't end with a line break.
  if (field !== "" || fields.length > 0) {
    endRow();
  }
  return { ok: true, value: rows };
}
