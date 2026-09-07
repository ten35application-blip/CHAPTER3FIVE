import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_PEOPLE, cleanBirthday, cleanEmail, copiesOf, loadPeople, rematchCopies } from "@/lib/legacy/relation";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The recorder's "who is this code for" list. Web (cookie) and mobile
 * (Bearer). Recorder only: their own archive, not an inherited copy.
 *   GET  ?oracle_id=…            → { people, redeemed, name }
 *   PUT  { oracle_id, people[] } → replaces the list, re-matches copies.
 * `redeemed` is names + relations only — never emails or birthdays.
 */
async function ownedOriginal(userId: string, oracleId: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("oracles")
    .select("id, name, user_id, is_legacy, inherited_at, deleted_at")
    .eq("id", oracleId)
    .maybeSingle();
  if (!row || row.user_id !== userId || row.deleted_at || !row.is_legacy || row.inherited_at) return null;
  return { admin, row };
}

export async function GET(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const oracleId = new URL(request.url).searchParams.get("oracle_id") ?? "";
  const owned = await ownedOriginal(user.id, oracleId);
  if (!owned) return NextResponse.json({ error: "We couldn't find that archive." }, { status: 404 });
  const people = await loadPeople(owned.admin, oracleId);
  const copies = await copiesOf(owned.admin, oracleId);
  const redeemed = copies.map((c) => ({
    status: c.holder_relation?.status ?? "unlisted",
    name: c.holder_relation?.status === "confirmed" ? (c.holder_relation.name ?? null) : (c.holder_relation?.declared_name ?? null),
    relation: c.holder_relation?.status === "confirmed" ? (c.holder_relation.relation ?? null) : null,
  }));
  return NextResponse.json({ people, redeemed, name: owned.row.name });
}

export async function PUT(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { oracle_id?: unknown; people?: unknown };
  const oracleId = typeof body.oracle_id === "string" ? body.oracle_id : "";
  const owned = await ownedOriginal(user.id, oracleId);
  if (!owned) return NextResponse.json({ error: "We couldn't find that archive." }, { status: 404 });

  const raw = Array.isArray(body.people) ? body.people : [];
  const people: { name: string; relation: string; email: string | null; birthday: string | null }[] = [];
  for (const p of raw.slice(0, MAX_PEOPLE)) {
    const o = (p ?? {}) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
    const relation = typeof o.relation === "string" ? o.relation.trim().slice(0, 60) : "";
    if (!name || !relation) continue;
    const email = cleanEmail(o.email);
    if (typeof o.email === "string" && o.email.trim() && !email) {
      return NextResponse.json({ error: `That email for ${name} doesn't look right.` }, { status: 400 });
    }
    const birthday = cleanBirthday(o.birthday);
    if (typeof o.birthday === "string" && o.birthday.trim() && !birthday) {
      return NextResponse.json({ error: `Birthday for ${name} should be a date.` }, { status: 400 });
    }
    people.push({ name, relation, email, birthday });
  }

  const { admin } = owned;
  const { error: delErr } = await admin.from("archive_people").delete().eq("oracle_id", oracleId);
  if (delErr) return NextResponse.json({ error: "Couldn't save the list. Try again." }, { status: 500 });
  if (people.length > 0) {
    const { error: insErr } = await admin
      .from("archive_people")
      .insert(people.map((p) => ({ oracle_id: oracleId, user_id: user.id, ...p })));
    if (insErr) return NextResponse.json({ error: "Couldn't save the list. Try again." }, { status: 500 });
  }
  let rematched = 0;
  try {
    rematched = await rematchCopies(admin, oracleId);
  } catch (err) {
    console.error("[legacy/people] rematch failed:", err);
  }
  return NextResponse.json({ ok: true, count: people.length, rematched });
}
