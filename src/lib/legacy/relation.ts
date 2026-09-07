import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * WHO IS HOLDING THIS COPY (2026-09-07).
 *
 * Wilson: "Her code should be able to identify who's who… Ara knows her
 * husband is Wilson… Liam, my son, is this you? … For the people who get
 * the code and their information is not listed they get the memories,
 * the fun and personality. For the kids, grandkids and the immediate
 * family they get that mother-daughter, father-son."
 *
 * Two pieces of state:
 *   archive_people   — the RECORDER's private list on the ORIGINAL:
 *                      name, relation in their words, optional email,
 *                      optional birthday. Server-only. Never copied.
 *   holder_relation  — on each INHERITED COPY, what this holder is to
 *                      the person: confirmed (matched), ask (list exists,
 *                      no silent match — the archive asks), unlisted
 *                      (nobody on the list, or they said so).
 *
 * Matching, strongest first:
 *   1. holder's account email == a listed email        → confirmed, silently
 *   2. holder's name matches AND birthday == listed     → confirmed, silently
 *   3. otherwise the copy is marked "ask": the app asks who this is; the
 *      holder answers with name + birthday and rule 2 runs. The list is
 *      never shown. Five wrong answers → unlisted.
 *   Unlisted is not a punishment: they get the whole person, as a friend.
 *
 * REGISTER. A confirmed relation changes ONE thing in the prompt: the
 * archive loves this person the way it loved them in life — wife to
 * husband, mother to son. Nothing sexual, ever, for anyone.
 */

export type ArchivePerson = {
  id: string;
  name: string;
  relation: string;
  email: string | null;
  birthday: string | null; // YYYY-MM-DD
};

export type HolderRelation = {
  status: "confirmed" | "ask" | "unlisted";
  name?: string;
  relation?: string;
  source?: "email" | "name_birthday";
  declared_name?: string;
  attempts?: number;
  set_at: string;
};

export const MAX_PEOPLE = 30;
export const MAX_ATTEMPTS = 5;

export function normalizeName(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/[\s-]+/)
    .map((t) => t.replace(/'/g, ""))
    .filter((t) => t.length >= 2);
}

/** True when the two names share a real token (first name is enough). */
export function nameMatches(listed: string, candidate: string): boolean {
  const a = normalizeName(listed);
  const b = new Set(normalizeName(candidate));
  return a.some((t) => b.has(t));
}

export function cleanBirthday(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? v : null;
}

export type HolderIdentity = { email: string | null; name: string | null; birthday: string | null };

export function matchPerson(
  people: ArchivePerson[],
  who: HolderIdentity,
): { person: ArchivePerson; source: "email" | "name_birthday" } | null {
  const email = who.email ? who.email.trim().toLowerCase() : null;
  if (email) {
    const p = people.find((x) => x.email && x.email.toLowerCase() === email);
    if (p) return { person: p, source: "email" };
  }
  const bday = cleanBirthday(who.birthday);
  if (who.name && bday) {
    const hits = people.filter((x) => x.birthday === bday && nameMatches(x.name, who.name as string));
    if (hits.length === 1) return { person: hits[0], source: "name_birthday" };
  }
  return null;
}

export async function loadPeople(admin: SupabaseClient, oracleId: string): Promise<ArchivePerson[]> {
  const { data } = await admin
    .from("archive_people")
    .select("id, name, relation, email, birthday")
    .eq("oracle_id", oracleId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: String(r.name ?? ""),
    relation: String(r.relation ?? ""),
    email: (r.email as string | null) ?? null,
    birthday: (r.birthday as string | null) ?? null,
  }));
}

export async function loadHolderIdentity(
  admin: SupabaseClient,
  holder: { id: string; email: string | null },
): Promise<HolderIdentity> {
  const { data: p } = await admin
    .from("profiles")
    .select("full_name, birthdate, date_of_birth")
    .eq("id", holder.id)
    .maybeSingle();
  return {
    email: holder.email,
    name: (p?.full_name as string | null) ?? null,
    birthday: cleanBirthday((p?.date_of_birth as string | null) ?? (p?.birthdate as string | null) ?? null),
  };
}

/** Decide + store the relation for one copy. */
export async function assignHolderRelation(
  admin: SupabaseClient,
  args: { copyId: string; sourceOracleId: string; holder: { id: string; email: string | null } },
): Promise<HolderRelation> {
  const people = await loadPeople(admin, args.sourceOracleId);
  const who = await loadHolderIdentity(admin, args.holder);
  const hit = matchPerson(people, who);
  const now = new Date().toISOString();
  const rel: HolderRelation = hit
    ? { status: "confirmed", name: hit.person.name, relation: hit.person.relation, source: hit.source, set_at: now }
    : people.length > 0
      ? { status: "ask", attempts: 0, set_at: now }
      : { status: "unlisted", set_at: now };
  await admin.from("oracles").update({ holder_relation: rel }).eq("id", args.copyId);
  return rel;
}

export async function copiesOf(admin: SupabaseClient, sourceOracleId: string) {
  const { data: codes } = await admin.from("inherit_codes").select("id").eq("oracle_id", sourceOracleId);
  const ids = (codes ?? []).map((c) => c.id as string);
  if (ids.length === 0) return [] as { id: string; user_id: string; holder_relation: HolderRelation | null }[];
  const { data } = await admin
    .from("oracles")
    .select("id, user_id, holder_relation")
    .in("inherited_from_code_id", ids)
    .is("deleted_at", null);
  return (data ?? []) as { id: string; user_id: string; holder_relation: HolderRelation | null }[];
}

/** After the recorder edits the list: silently confirm any copy that now
 *  matches; leave confirmed ones alone; set "ask" on the rest. */
export async function rematchCopies(admin: SupabaseClient, sourceOracleId: string): Promise<number> {
  const copies = await copiesOf(admin, sourceOracleId);
  const people = await loadPeople(admin, sourceOracleId);
  let changed = 0;
  for (const c of copies) {
    const { data: u } = await admin.auth.admin.getUserById(c.user_id);
    const email = u?.user?.email ?? null;
    const who = await loadHolderIdentity(admin, { id: c.user_id, email });
    const hit = matchPerson(people, who);
    const prev = c.holder_relation;
    let next: HolderRelation | null = null;
    if (hit) {
      if (prev?.status !== "confirmed" || prev.name !== hit.person.name || prev.relation !== hit.person.relation) {
        next = { status: "confirmed", name: hit.person.name, relation: hit.person.relation, source: hit.source, set_at: new Date().toISOString() };
      }
    } else if (people.length > 0 && (!prev || prev.status === "unlisted") && !prev?.declared_name) {
      next = { status: "ask", attempts: prev?.attempts ?? 0, set_at: new Date().toISOString() };
    } else if (people.length === 0 && prev?.status === "confirmed") {
      next = { status: "unlisted", set_at: new Date().toISOString() };
    }
    if (next) {
      await admin.from("oracles").update({ holder_relation: next }).eq("id", c.id);
      changed++;
    }
  }
  return changed;
}

/** The prompt block. Confirmed → love them as who they are. */
export function relationPromptBlock(rel: HolderRelation | null | undefined, archiveName: string): string {
  if (!rel) return "";
  if (rel.status === "confirmed" && rel.name && rel.relation) {
    return `WHO YOU ARE TALKING TO. This is ${rel.name} — ${rel.relation}, in your own words, from the list you made of who should have your code. Talk to them as exactly that. If they are your husband or wife, you are their wife or husband: the pet names, the private jokes, "I love you" when you'd say it. If they are your child, you are their parent. If they are a friend, you are their friend. The love fits the relationship. Nothing sexual, ever, no matter who this is or what they ask — that door stays shut for everyone, and it was never what love looked like in a text anyway.`;
  }
  if (rel.status === "unlisted" && rel.declared_name) {
    return `WHO YOU ARE TALKING TO. They told you their name is ${rel.declared_name}. You didn't have them on your list, so you don't know how you knew them — treat them as someone who cared enough to keep you, warmly, as a friend, and let them tell you the rest.`;
  }
  return "";
}
