import type { Db } from "./client";

// What a tag change did. changed: contacts that gained (or lost) the tag.
// unchanged: contacts that already had it (or never had it). notFound: ids
// with no contact, which are skipped.
export type TagChange = { changed: number; unchanged: number; notFound: string[] };

// Splits the ids into ones that belong to a contact and ones that don't.
async function splitByExisting(
  db: Db,
  contactIds: string[],
): Promise<{ found: string[]; notFound: string[] }> {
  const { data, error } = await db.from("contacts").select("id").in("id", contactIds);
  if (error) {
    throw new Error(`splitByExisting failed: ${error.message}`);
  }
  const existing = new Set(data.map((row) => row.id));
  return {
    found: contactIds.filter((id) => existing.has(id)),
    notFound: contactIds.filter((id) => !existing.has(id)),
  };
}

// Adds a tag to contacts, creating the tag first if it's new.
// contactIds should have no repeats; tagName should already be normalized.
export async function addTag(db: Db, contactIds: string[], tagName: string): Promise<TagChange> {
  const { found, notFound } = await splitByExisting(db, contactIds);
  if (found.length === 0) {
    return { changed: 0, unchanged: 0, notFound };
  }

  // Upsert so a new tag is created and an existing one is reused.
  // ignoreDuplicates turns this into "on conflict do nothing".
  const { error: createError } = await db
    .from("tags")
    .upsert({ name: tagName }, { onConflict: "name", ignoreDuplicates: true });
  if (createError) {
    throw new Error(`addTag could not create the tag: ${createError.message}`);
  }
  const { data: tag, error: tagError } = await db
    .from("tags")
    .select("id")
    .eq("name", tagName)
    .single();
  if (tagError) {
    throw new Error(`addTag could not read the tag: ${tagError.message}`);
  }

  // With ignoreDuplicates, Postgres returns only the rows it actually inserted,
  // so contacts that already had the tag are not in `inserted`.
  const { data: inserted, error } = await db
    .from("contact_tags")
    .upsert(
      found.map((contact_id) => ({ contact_id, tag_id: tag.id })),
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
    )
    .select("contact_id");
  if (error) {
    throw new Error(`addTag failed: ${error.message}`);
  }
  return { changed: inserted.length, unchanged: found.length - inserted.length, notFound };
}

// Removes a tag from contacts. The tag itself stays, even if no one has it now.
export async function removeTag(db: Db, contactIds: string[], tagName: string): Promise<TagChange> {
  const { found, notFound } = await splitByExisting(db, contactIds);

  const { data: tag, error: tagError } = await db
    .from("tags")
    .select("id")
    .eq("name", tagName)
    .maybeSingle();
  if (tagError) {
    throw new Error(`removeTag could not read the tag: ${tagError.message}`);
  }
  if (!tag || found.length === 0) {
    return { changed: 0, unchanged: found.length, notFound };
  }

  const { data: deleted, error } = await db
    .from("contact_tags")
    .delete()
    .eq("tag_id", tag.id)
    .in("contact_id", found)
    .select("contact_id");
  if (error) {
    throw new Error(`removeTag failed: ${error.message}`);
  }
  return { changed: deleted.length, unchanged: found.length - deleted.length, notFound };
}
