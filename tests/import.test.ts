import { describe, expect, it } from "vitest";
import { MAX_IMPORT_ROWS, type PreparedImport, prepareImport } from "@/lib/contacts/import";

// Unwraps a successful prepare so each test can look at rows and rejections.
function prepared(csv: string): PreparedImport {
  const result = prepareImport(csv);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.value;
}

function failure(csv: string): string {
  const result = prepareImport(csv);
  return result.ok ? "(no failure)" : result.reason;
}

describe("prepareImport: whole-file problems", () => {
  it("needs a phone column", () => {
    expect(failure("first_name,last_name\nMaya,Okafor")).toContain("no phone column");
  });

  it("needs at least one data row", () => {
    expect(failure("phone,first_name\n")).toContain("no data rows");
    expect(failure("")).toContain("empty");
  });

  it("caps the number of rows", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => "+13125550101");
    expect(failure(["phone", ...rows].join("\n"))).toContain("limit is 5000");
  });

  it("refuses a repeated column and passes on CSV syntax errors", () => {
    expect(failure("phone,Mobile\n1,2")).toContain('"phone" more than once');
    expect(failure('phone\n"+13125550101')).toContain("never closed");
  });
});

describe("prepareImport: rows", () => {
  it("normalizes every field and leaves blank ones out", () => {
    const { rows } = prepared(
      "Mobile,First Name,last_name,TZ,tags,consent,Ward\n" +
        "(312) 555-0131, Alma ,,america/chicago,Volunteers; donors;volunteers,Yes,3\n",
    );
    expect(rows).toEqual([
      {
        phone_e164: "+13125550131",
        first_name: "Alma",
        timezone: "America/Chicago",
        tags: ["volunteers", "donors"],
        consent: "opt_in",
        custom_fields: { ward: "3" },
      },
    ]);
  });

  it("reads consent words and treats blank consent as none", () => {
    const { rows } = prepared("phone,consent\n3125550131,no\n3125550132,\n3125550133,1\n");
    expect(rows.map((row) => row.consent)).toEqual(["opt_out", undefined, "opt_in"]);
  });

  it("rejects bad rows with the line number and a reason, and keeps the rest", () => {
    const { rows, rejected, dataRows } = prepared(
      "phone,first_name,timezone,consent,tags\n" +
        "3125550131,Alma,,,\n" + // line 2: good
        "555-0133,Cal,,,\n" + // line 3: bad phone
        "(312) 555-0131,Again,,,\n" + // line 4: same phone as line 2
        "3125550134,Dee\n" + // line 5: missing fields
        "3125550135,Eli,EST,,\n" + // line 6: bad timezone
        "3125550136,Fay,,maybe,\n" + // line 7: bad consent
        "3125550137,Gus,,,big donors\n", // line 8: bad tag
    );

    expect(dataRows).toBe(7);
    expect(rows.map((row) => row.phone_e164)).toEqual(["+13125550131"]);
    expect(rejected.map(({ line, reason }) => [line, reason])).toEqual([
      [3, expect.stringContaining("10-digit")],
      [4, "Same phone as line 2. Only the first row for a phone is imported."],
      [5, "Has 2 fields; the header has 5."],
      [6, expect.stringContaining("not a known timezone")],
      [7, expect.stringContaining("must be yes or no")],
      [8, expect.stringContaining("Tag")],
    ]);
    expect(rejected[0].phone).toBe("555-0133");
  });

  it("turns extra columns into custom fields and lists ones it can't use", () => {
    const { rows, customFieldColumns, ignoredColumns } = prepared(
      "phone,Zip Code,Notes (internal)\n3125550131,60601,call after 5\n",
    );
    expect(customFieldColumns).toEqual(["zip_code"]);
    expect(ignoredColumns).toEqual(["Notes (internal)"]);
    expect(rows[0].custom_fields).toEqual({ zip_code: "60601" });
  });
});
