// The send rules from the brief, as pure functions. send_message and the
// broadcast tools both call checkSend, so the rules live in one place.
import type { Enums } from "@/lib/db/database.types";

export const MAX_BODY_LENGTH = 1600;
export const OPT_OUT_FOOTER = "Reply STOP to opt out";
export const SENDING_WINDOW = { startHour: 8, endHour: 21 };

// Why a send was refused. Broadcast previews count skips by this code.
export type RefusalCode =
  | "opted_out"
  | "no_consent"
  | "missing_timezone"
  | "outside_window"
  | "empty_body"
  | "body_too_long";

export type SendCheck =
  { ok: true; body: string } | { ok: false; code: RefusalCode; reason: string };

export interface SendTarget {
  name: string;
  timezone: string | null;
  consentStatus: Enums<"consent_type"> | null;
  // True when the contact has never been sent a message.
  isFirstMessage: boolean;
}

// Runs every rule in order and returns the first refusal, or the final body
// (with the opt-out footer added when needed).
export function checkSend(target: SendTarget, body: string, now: Date): SendCheck {
  if (target.consentStatus === "opt_out") {
    return refuse(
      "opted_out",
      `${target.name} has opted out. Opted-out contacts can't be messaged.`,
    );
  }
  if (target.consentStatus !== "opt_in") {
    return refuse(
      "no_consent",
      `${target.name} has no opt-in on record. Consent comes from a CSV import with a consent column, or from the contact texting START.`,
    );
  }

  const window = checkSendingWindow(target.timezone, now);
  if (!window.ok) {
    return refuse(window.code, `${target.name}: ${window.reason}`);
  }

  const finalBody = target.isFirstMessage ? addOptOutFooter(body) : body.trim();
  return checkBody(finalBody);
}

export function checkBody(body: string): SendCheck {
  if (body.trim() === "") {
    return refuse("empty_body", "The message body is empty.");
  }
  // Count characters, not UTF-16 units, so an emoji counts once.
  const length = [...body].length;
  if (length > MAX_BODY_LENGTH) {
    return refuse(
      "body_too_long",
      `The message is ${length} characters. The limit is ${MAX_BODY_LENGTH}, including the opt-out footer on a first message.`,
    );
  }
  return { ok: true, body };
}

// The first message to a contact must tell them how to opt out, unless the
// body already mentions STOP.
export function addOptOutFooter(body: string): string {
  const trimmed = body.trim();
  if (trimmed === "" || /\bstop\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}\n\n${OPT_OUT_FOOTER}`;
}

type WindowCheck =
  | { ok: true; localTime: string }
  | { ok: false; code: "missing_timezone" | "outside_window"; reason: string };

// Allowed from 8:00 up to (not including) 21:00 in the contact's timezone.
export function checkSendingWindow(timezone: string | null, now: Date): WindowCheck {
  if (!timezone) {
    return {
      ok: false,
      code: "missing_timezone",
      reason:
        "their timezone is unknown, so the sending window can't be checked. Ask the user for it and save it with upsert_contact.",
    };
  }

  const local = localTime(timezone, now);
  if (!local) {
    return {
      ok: false,
      code: "missing_timezone",
      reason: `their timezone "${timezone}" isn't recognized. Fix it with upsert_contact.`,
    };
  }

  const { startHour, endHour } = SENDING_WINDOW;
  if (local.hour < startHour || local.hour >= endHour) {
    return {
      ok: false,
      code: "outside_window",
      reason: `it's ${local.text} in ${timezone}. Messages can only go out between ${startHour}:00 and ${endHour}:00 local time.`,
    };
  }
  return { ok: true, localTime: local.text };
}

function localTime(timezone: string, now: Date): { hour: number; text: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return { hour, text: `${hour}:${minute}` };
  } catch {
    // Intl throws a RangeError for a timezone name it doesn't know.
    return null;
  }
}

function refuse(code: RefusalCode, reason: string): SendCheck {
  return { ok: false, code, reason };
}
