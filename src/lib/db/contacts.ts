import type { Db } from "./client";
import type { Enums, Tables } from "./database.types";

export type Contact = Tables<"contacts">;

export type ConsentStatus = {
  contactId: string;
  status: Enums<"consent_type"> | null;
  channel: Enums<"consent_channel"> | null;
  statusAt: string | null;
  isOptedOut: boolean;
};

export async function findContactByPhone(db: Db, phoneE164: string): Promise<Contact | null> {
  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (error) {
    throw new Error(`findContactByPhone failed: ${error.message}`);
  }
  return data;
}

export async function getConsentStatus(db: Db, contactId: string): Promise<ConsentStatus | null> {
  const { data, error } = await db
    .from("contact_consent_status")
    .select("contact_id, status, channel, status_at, is_opted_out")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (error) {
    throw new Error(`getConsentStatus failed: ${error.message}`);
  }
  if (!data || !data.contact_id) {
    return null;
  }

  return {
    contactId: data.contact_id,
    status: data.status,
    channel: data.channel,
    statusAt: data.status_at,
    isOptedOut: data.is_opted_out ?? false,
  };
}

export type ConsentFilter = "opted_in" | "opted_out" | "unknown";

export type ContactSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  timezone: string | null;
  tags: string[];
  consentStatus: Enums<"consent_type"> | null;
  consentChannel: Enums<"consent_channel"> | null;
  consentStatusAt: string | null;
  isOptedOut: boolean;
};

export type RecentMessage = Pick<
  Tables<"messages">,
  "id" | "created_at" | "direction" | "body" | "status"
>;

export type ContactDetails = ContactSummary & { recentMessages: RecentMessage[] };

export type SearchContactsInput = {
  name?: string;
  phone?: string;
  tag?: string;
  consent?: ConsentFilter;
  limit: number;
  cursor?: string;
};

const CONTACT_COLUMNS =
  "id, first_name, last_name, phone_e164, timezone, consent_status, consent_channel, consent_status_at, is_opted_out, contact_tags(tags(name))";

// Same columns plus a second copy of the tag join, used only for filtering by tag.
// Filtering the first copy would hide the contact's other tags from the result.
const SEARCH_COLUMNS = `${CONTACT_COLUMNS}, tag_match:contact_tags(tags!inner(name))` as const;

type ContactRow = {
  id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  timezone: string | null;
  consent_status: Enums<"consent_type"> | null;
  consent_channel: Enums<"consent_channel"> | null;
  consent_status_at: string | null;
  is_opted_out: boolean | null;
  contact_tags: { tags: { name: string } | null }[];
};

// View columns are always nullable in generated types, even when the
// underlying table column is NOT NULL, so id and phone get a fallback.
function toContactSummary(row: ContactRow): ContactSummary {
  return {
    id: row.id ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone_e164 ?? "",
    timezone: row.timezone,
    tags: row.contact_tags.flatMap((link) => (link.tags ? [link.tags.name] : [])).sort(),
    consentStatus: row.consent_status,
    consentChannel: row.consent_channel,
    consentStatusAt: row.consent_status_at,
    isOptedOut: row.is_opted_out ?? false,
  };
}

export async function searchContacts(
  db: Db,
  input: SearchContactsInput,
): Promise<{ contacts: ContactSummary[]; nextCursor: string | null }> {
  // Ask for one extra row: if it comes back, there is another page.
  let query = db
    .from("contacts_with_consent")
    .select(SEARCH_COLUMNS)
    .order("id")
    .limit(input.limit + 1);

  // Every word must match the first or the last name.
  for (const word of input.name?.split(/\s+/).filter(Boolean) ?? []) {
    query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`);
  }
  if (input.phone) {
    query = query.like("phone_e164", `%${input.phone.replace(/\D/g, "")}%`);
  }
  if (input.tag) {
    query = query.eq("tag_match.tags.name", input.tag).not("tag_match", "is", null);
  }
  if (input.consent === "opted_out") {
    query = query.eq("is_opted_out", true);
  } else if (input.consent === "opted_in") {
    query = query.eq("consent_status", "opt_in");
  } else if (input.consent === "unknown") {
    query = query.is("consent_status", null);
  }
  if (input.cursor) {
    query = query.gt("id", input.cursor);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`searchContacts failed: ${error.message}`);
  }

  const hasMore = data.length > input.limit;
  const page = data.slice(0, input.limit).map(toContactSummary);
  return { contacts: page, nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
}

export type ContactLookup = { id: string } | { phone: string };

export async function findContact(db: Db, lookup: ContactLookup): Promise<ContactSummary | null> {
  let query = db.from("contacts_with_consent").select(CONTACT_COLUMNS);
  query = "id" in lookup ? query.eq("id", lookup.id) : query.eq("phone_e164", lookup.phone);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`findContact failed: ${error.message}`);
  }
  return data ? toContactSummary(data) : null;
}

export async function getContactDetails(
  db: Db,
  lookup: ContactLookup,
): Promise<ContactDetails | null> {
  const contact = await findContact(db, lookup);
  if (!contact) {
    return null;
  }

  const { data: messages, error } = await db
    .from("messages")
    .select("id, created_at, direction, body, status")
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`getContactDetails failed: ${error.message}`);
  }
  return { ...contact, recentMessages: messages };
}
