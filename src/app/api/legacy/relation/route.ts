import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_ATTEMPTS, cleanBirthday, loadPeople, matchPerson, type HolderRelation } from "@/lib/legacy/relation";

export const runtime = "nodejs";

/**
 * The holder's side of "is this you?". POST { oracle_id (their copy),
 * name, birthday } or { oracle_id, skip: true }. The list is never sent
 * down; the holder says who they are and the server checks.
 */
export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { oracle_id?: unknown; name?: unknown; birthday?: unknown; skip?: unknown };
  const copyId = typeof body.oracle_id === "string" ? body.oracle_id : "";
  const admin = createAdminClient();
  const { data: copy } = await admin
    .from("oracles")
    .select("id, user_id, name, inherited_from_code_id, holder_relation, deleted_at")
    .eq("id", copyId)
    .maybeSingle();
  if (!copy || copy.user_id !== user.id || copy.deleted_at || !copy.inherited_from_code_id) {
    return NextResponse.json({ error: "We couldn't find that archive." }, { status: 404 });
  }
  const prev = (copy.holder_relation as HolderRelation | null) ?? null;
  if (prev?.status === "confirmed") return NextResponse.json({ ok: true, relation: prev });
  const now = new Date().toISOString();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  if (body.skip === true) {
    const rel: HolderRelation = { status: "unlisted", set_at: now, ...(name ? { declared_name: name } : {}) };
    await admin.from("oracles").update({ holder_relation: rel }).eq("id", copy.id);
    return NextResponse.json({ ok: true, relation: rel });
  }
  const birthday = cleanBirthday(body.birthday);
  if (!name || !birthday) return NextResponse.json({ error: "Your name and your birthday, please." }, { status: 400 });

  const { data: code } = await admin.from("inherit_codes").select("oracle_id").eq("id", copy.inherited_from_code_id).maybeSingle();
  const sourceId = (code?.oracle_id as string | undefined) ?? null;
  const people = sourceId ? await loadPeople(admin, sourceId) : [];
  const hit = matchPerson(people, { email: null, name, birthday });
  const attempts = (prev?.attempts ?? 0) + 1;
  let rel: HolderRelation;
  if (hit) rel = { status: "confirmed", name: hit.person.name, relation: hit.person.relation, source: "name_birthday", set_at: now };
  else if (attempts >= MAX_ATTEMPTS) rel = { status: "unlisted", declared_name: name, attempts, set_at: now };
  else rel = { status: "ask", attempts, set_at: now, declared_name: name };
  await admin.from("oracles").update({ holder_relation: rel }).eq("id", copy.id);
  return NextResponse.json({ ok: true, relation: rel, matched: !!hit, attempts_left: hit ? null : Math.max(0, MAX_ATTEMPTS - attempts) });
}
