import type { Json } from "@/lib/db/database.types";

// Matches an E.164 number anywhere in a string, e.g. "+13125550112".
const PHONE_PATTERN = /\+[1-9]\d{7,14}/g;
const MAX_STRING_LENGTH = 100;

// "+13125550112" -> "+1312***0112"
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 5)}***${phone.slice(-4)}`;
}

export function maskPhonesInText(text: string): string {
  return text.replace(PHONE_PATTERN, (match) => maskPhone(match));
}

export function truncate(text: string, max = MAX_STRING_LENGTH): string {
  return text.length > max ? `${text.slice(0, max)}... (${text.length} chars)` : text;
}

// Makes tool arguments safe to store: masks phone numbers and shortens long text
// (message bodies, CSV uploads). Walks nested objects and arrays.
export function redactArgs(value: unknown): Json {
  if (typeof value === "string") {
    return truncate(maskPhonesInText(value));
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactArgs);
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactArgs(item)]));
  }
  // undefined, functions, and anything else JSON cannot hold.
  return null;
}
