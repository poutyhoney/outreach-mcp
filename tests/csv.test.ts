import { describe, expect, it } from "vitest";
import { type CsvRow, parseCsv } from "@/lib/contacts/csv";

// Unwraps a successful parse so each test can compare rows directly.
function rows(text: string): CsvRow[] {
  const result = parseCsv(text);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.value;
}

describe("parseCsv", () => {
  it("splits records and fields, with or without a final line break", () => {
    expect(rows("phone,first_name\n+13125550101,Maya\n")).toEqual([
      { line: 1, fields: ["phone", "first_name"] },
      { line: 2, fields: ["+13125550101", "Maya"] },
    ]);
    expect(rows("a,b\n1,2")).toEqual(rows("a,b\n1,2\n"));
  });

  it("keeps empty fields, including a trailing one", () => {
    expect(rows("a,,c,")).toEqual([{ line: 1, fields: ["a", "", "c", ""] }]);
  });

  it("handles quoted commas and escaped quotes", () => {
    expect(rows('"Okafor, Maya","She said ""hi"""')).toEqual([
      { line: 1, fields: ["Okafor, Maya", 'She said "hi"'] },
    ]);
  });

  it("keeps line breaks inside quotes and reports where each record starts", () => {
    expect(rows('name,note\nMaya,"line one\nline two"\nDaniel,ok')).toEqual([
      { line: 1, fields: ["name", "note"] },
      { line: 2, fields: ["Maya", "line one\nline two"] },
      { line: 4, fields: ["Daniel", "ok"] },
    ]);
  });

  it("accepts Windows line endings and a byte order mark", () => {
    expect(rows("\uFEFFa,b\r\n1,2\r\n")).toEqual([
      { line: 1, fields: ["a", "b"] },
      { line: 2, fields: ["1", "2"] },
    ]);
  });

  it("skips blank lines but keeps counting them", () => {
    expect(rows("a\n\n  \nb")).toEqual([
      { line: 1, fields: ["a"] },
      { line: 4, fields: ["b"] },
    ]);
  });

  it("returns an empty list for empty text", () => {
    expect(rows("")).toEqual([]);
  });

  it("reports a quote that is never closed", () => {
    const result = parseCsv('a,b\n1,"open\n2,3');
    expect(result).toEqual({
      ok: false,
      reason: 'The row starting on line 2 has a quote (") that is never closed.',
    });
  });
});
