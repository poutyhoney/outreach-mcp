// Field rules for contact writes: upsert_contact, tag_contacts, and the CSV import.
// Pure functions with no database access, so they are quick to unit test.

// The result of checking one value: the cleaned-up value, or a reason the
// model (or the import report) can show the user.
export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
// US and Canada: area code and exchange each start with 2 to 9.
const NANP_PATTERN = /^[2-9]\d{2}[2-9]\d{6}$/;
const TAG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/;

// Custom field keys: what a message template can use, e.g. {{ward}}.
export const CUSTOM_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

// Accepts E.164 ("+13125550101") or a US/Canada number in a common format
// ("(312) 555-0101", "312.555.0101", "1-312-555-0101"). Numbers from other
// countries need a leading + and country code.
export function normalizePhone(input: string): Checked<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "Phone number is empty." };
  }
  if (/[^\d\s().+-]/.test(trimmed) || trimmed.lastIndexOf("+") > 0) {
    return { ok: false, reason: `"${trimmed}" has characters a phone number can't have.` };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && !digits.startsWith("1")) {
    const e164 = `+${digits}`;
    return E164_PATTERN.test(e164)
      ? { ok: true, value: e164 }
      : { ok: false, reason: `"${trimmed}" needs 8 to 15 digits after the +.` };
  }

  // US/Canada from here on: 10 digits, or 11 starting with country code 1.
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) {
    return {
      ok: false,
      reason: `"${trimmed}" is not a 10-digit US number. For other countries, start with + and the country code.`,
    };
  }
  if (!NANP_PATTERN.test(national)) {
    return {
      ok: false,
      reason: `"${trimmed}" is not a valid US number: the area code and exchange can't start with 0 or 1.`,
    };
  }
  return { ok: true, value: `+1${national}` };
}

// Accepts any IANA name the runtime knows, in any case, and returns its
// canonical spelling: "america/chicago" -> "America/Chicago".
export function normalizeTimezone(input: string): Checked<string> {
  const name = input.trim();
  const reason = `"${name}" is not a known timezone. Use an IANA name like America/Chicago.`;
  // Abbreviations like "EST" or "PST" are ambiguous, and the runtime maps
  // some to surprising places ("EST" becomes America/Panama). Require Area/City.
  if (!name.includes("/") && name.toUpperCase() !== "UTC") {
    return { ok: false, reason };
  }
  try {
    const { timeZone } = new Intl.DateTimeFormat("en-US", { timeZone: name }).resolvedOptions();
    return { ok: true, value: timeZone };
  } catch {
    return { ok: false, reason };
  }
}

// Tags are stored lowercase so "Volunteers" and "volunteers" are one tag.
export function normalizeTag(input: string): Checked<string> {
  const tag = input.trim().toLowerCase();
  return TAG_PATTERN.test(tag)
    ? { ok: true, value: tag }
    : {
        ok: false,
        reason: `Tag "${input.trim()}" must be 1 to 50 letters, digits, hyphens, or underscores.`,
      };
}
