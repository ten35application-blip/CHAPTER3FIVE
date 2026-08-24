import { NextResponse, type NextRequest } from "next/server";
import { sendInheritCodeEmail } from "@/lib/notifications";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintInheritCode } from "@/lib/legacy/mint";

export const runtime = "nodejs";

/**
 * Bearer-authed twin of retryMintInheritCode (settings/actions.ts) —
 * mint the missing code for an archive whose completion-time mint
 * failed.
 *
 * Until this existed, the phone's Settings showed a codeless archive
 * with "Make a new one at chapter3five.app" — advice that is
 * IMPOSSIBLE to follow: the legacy quota is one self-mode and one
 * other-mode archive per account, and the codeless archive occupies
 * its slot. The web had a fix-it button; the phone had a dead end
 * pointing at directions that don't work. For the flow Wilson calls
 * the most important in the app — answer the questions, get the code,
 * hand it over — a failed mint on mobile was a permanent stall.
 *
 * Guards mirror the web action exactly, including the load-bearing
 * `.is("inherited_at", null)`: a redeemed COPY is is_legacy, owned by
 * the caller, and has no code row of its own — without this filter,
 * redeeming someone's archive for $5 would let you mint a fresh live
 * code for their dead relative, resellable, and unreachable by the
 * original family's revoke (it points at a different oracle row).
 *
 * The lookup runs on the USER client so RLS scopes it; only the mint
 * itself uses the admin client (0065 dropped user-side inserts on
 * inherit_codes).
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}) as { oracle_id?: unknown });
  const oracleId =
    typeof body.oracle_id === "string" ? body.oracle_id.trim() : "";
  if (!oracleId) {
    return NextResponse.json({ error: "Missing oracle_id" }, { status: 400 });
  }

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, is_legacy, name, one_line_hook, is_self_archive")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      is_legacy: boolean | null;
      name: string | null;
      one_line_hook: string | null;
      is_self_archive: boolean | null;
    }>();
  if (!oracle) {
    return NextResponse.json(
      { error: "That identity isn't one we can make a code for." },
      { status: 404 },
    );
  }

  // An unrevoked code already exists — a race, or a double-tap. Hand
  // back the real one instead of erroring; the user wants the code,
  // not an explanation.
  const { data: existing } = await supabase
    .from("inherit_codes")
    .select("code")
    .eq("oracle_id", oracleId)
    .is("revoked_at", null)
      // maybeSingle() nulls out on 2+ rows. Two live codes should be
      // impossible, but if a mint race ever produces them the owner
      // must still SEE a code (and mint paths must reuse one, not add
      // a third). Newest first.
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ code: string }>();
  if (existing?.code) {
    return NextResponse.json({ ok: true, code: existing.code });
  }

  const code = await mintInheritCode(createAdminClient(), oracleId, user.id);
  if (!code) {
    return NextResponse.json(
      {
        error:
          "We couldn't make a code just now. Try once more — nothing is lost, and your archive is safe.",
      },
      { status: 500 },
    );
  }

  // Same inbox copy the first-time mint sends — this path exists
  // precisely because the original mint failed, so it's the one place
  // a person most needs the code written down somewhere durable.
  if (user.email) {
    try {
      await sendInheritCodeEmail({
        to: user.email,
        userId: user.id,
        name: oracle.name ?? "Your archive",
        hook: oracle.one_line_hook ?? null,
        code,
        isSelf: oracle.is_self_archive === true,
      });
    } catch (mailErr) {
      console.error("[api/legacy/retry-mint] inherit-code email failed:", mailErr);
    }
  }

  return NextResponse.json({ ok: true, code });
}
