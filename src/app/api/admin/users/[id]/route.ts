import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { isAdmin } from "@/lib/admin/allowlist";
import { safeCount, safeSelect, type PaymentRow } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[id] — JSON twin of /admin/users/[id]:
 * everything about one account in one place. Profile, plan, owned
 * identities, message count, recent payments, inherit codes created
 * and inherited copies redeemed — the exact reads the web detail page
 * runs, plus a count of reports this user has filed (mobile shows it
 * on the same screen).
 */
type ProfileRow = {
  full_name: string | null;
  terms_accepted_at: string | null;
  terms_version_accepted: string | null;
  deleted_at: string | null;
  pro_until: string | null;
  plan_source: string | null;
  inherited_slot_credits: number | null;
  message_credits: number | null;
  image_credits: number | null;
};

type OracleRow = {
  id: string;
  name: string;
  is_legacy: boolean | null;
  created_at: string;
};

type CodeRow = {
  id: string;
  code: string;
  revoked_at: string | null;
  created_at: string;
};

/** Inherited copy (0111): an owned oracle stamped at redemption time. */
type InheritedRow = {
  id: string;
  name: string | null;
  inherited_at: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;
  const { id } = await params;

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(id);
  const user = userData?.user;
  if (userError || !user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // "Reports about this user's content" — count message_reports whose
  // message_id points to a row where messages.user_id = this user.
  // Can't be one PostgREST-friendly query, so grab the id list first
  // then count reports in on it. Same admin client so RLS's absent
  // cross-user visibility isn't in the way.
  const { data: theirMessageIds } = await supabase
    .from("messages")
    .select("id")
    .eq("user_id", id);
  const messageIdList = (theirMessageIds ?? []).map((r) => r.id as string);

  const [
    profiles,
    oracles,
    chatCount,
    payments,
    codes,
    shares,
    reportsFiled,
    reportsAbout,
  ] = await Promise.all([
      safeSelect<ProfileRow>(
        supabase,
        "profiles",
        "full_name, terms_accepted_at, terms_version_accepted, deleted_at, pro_until, plan_source, inherited_slot_credits, message_credits, image_credits",
        (q) => q.eq("id", id),
      ),
      safeSelect<OracleRow>(
        supabase,
        "oracles",
        "id, name, is_legacy, created_at",
        (q) =>
          q
            .eq("user_id", id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
      ),
      safeCount(supabase, "messages", (q) => q.eq("user_id", id)),
      safeSelect<PaymentRow>(
        supabase,
        "payments",
        "id, user_id, amount_cents, currency, purpose, status, created_at, paid_at",
        (q) =>
          q.eq("user_id", id).order("created_at", { ascending: false }).limit(10),
      ),
      safeSelect<CodeRow>(
        supabase,
        "inherit_codes",
        "id, code, revoked_at, created_at",
        (q) => q.eq("created_by", id).order("created_at", { ascending: false }),
      ),
      safeSelect<InheritedRow>(
        supabase,
        "oracles",
        "id, name, inherited_at",
        (q) =>
          q
            .eq("user_id", id)
            .not("inherited_at", "is", null)
            .order("inherited_at", { ascending: false }),
      ),
      safeCount(supabase, "message_reports", (q) =>
        q.eq("reporter_user_id", id),
      ),
      messageIdList.length > 0
        ? safeCount(supabase, "message_reports", (q) =>
            q.in("message_id", messageIdList),
          )
        : Promise.resolve(0),
    ]);

  const profile = profiles[0] ?? null;
  const userIsAdmin = isAdmin(user.email);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      is_admin: userIsAdmin,
    },
    profile,
    plan: planLabel(profile ?? undefined, userIsAdmin),
    identities: oracles,
    message_count: chatCount,
    payments,
    inherit_codes: codes,
    inherited_copies: shares,
    // Kept for back-compat with the initially-shipped mobile UI —
    // equals reports_filed (Fable's original interpretation). New
    // fields split the two directions of "reports" the admin needs
    // to see: filed BY the user vs about the user's content.
    report_count: reportsFiled,
    reports_filed: reportsFiled,
    reports_about: reportsAbout,
  });
}

/**
 * Renders the user's plan state: admins are always "Pro (admin)".
 * profiles.pro_until in the future is "Pro until [date] (source)".
 * Anything else is "Free". Verbatim port of the web detail page's
 * planLabel().
 */
function planLabel(
  profile: ProfileRow | undefined,
  userIsAdmin: boolean,
): string {
  if (userIsAdmin) return "Pro (admin allowlist)";
  if (!profile?.pro_until) return "Free";
  const until = new Date(profile.pro_until);
  if (until.getTime() <= Date.now()) return "Free (Pro expired)";
  const source =
    profile.plan_source === "admin_grant"
      ? "admin grant"
      : profile.plan_source === "stripe"
        ? "Stripe"
        : profile.plan_source ?? "unknown";
  return `Pro until ${until.toLocaleDateString()} · ${source}`;
}
