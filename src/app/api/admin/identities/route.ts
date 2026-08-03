import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { getEmailMap, safeCount, safeSelect } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/identities — JSON twin of /admin/identities.
 * Newest first, filterable by type, with the owner's email stitched
 * on from the GoTrue admin API (same as the web list).
 *
 * Query params:
 *   filter — all|randomized|legacy (default all). is_legacy is null
 *            on pre-0055 rows — treated as randomized, same as web.
 *   limit  — default 50, hard cap 200
 *   offset — default 0
 */
type OracleRow = {
  id: string;
  name: string;
  user_id: string;
  is_legacy: boolean | null;
  one_line_hook: string | null;
  created_at: string;
};

type FilterKey = "all" | "randomized" | "legacy";

export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;

  const url = new URL(request.url);
  const rawFilter = url.searchParams.get("filter") ?? "";
  const filter: FilterKey =
    rawFilter === "randomized" || rawFilter === "legacy" ? rawFilter : "all";
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );
  // Search by identity name OR owner email. Both surfaces run through
  // this endpoint (mobile identity list). Name filter runs server-side
  // via ilike; email filter is client-side after the getEmailMap
  // stitch, so the pre-stitch page can't paginate against email
  // matches — that's a corner case we accept, matching web behavior.
  const search =
    (url.searchParams.get("search") ?? url.searchParams.get("q") ?? "")
      .trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilter = (q: any) => {
    let query = q.is("deleted_at", null);
    if (filter === "legacy") query = query.eq("is_legacy", true);
    if (filter === "randomized")
      query = query.or("is_legacy.eq.false,is_legacy.is.null");
    if (search) query = query.ilike("name", `%${search}%`);
    return query;
  };

  const [oracles, total, emails] = await Promise.all([
    safeSelect<OracleRow>(
      supabase,
      "oracles",
      "id, name, user_id, is_legacy, one_line_hook, created_at",
      (q) =>
        applyFilter(q)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),
    ),
    safeCount(supabase, "oracles", applyFilter),
    getEmailMap(supabase),
  ]);

  return NextResponse.json({
    identities: oracles.map((o) => ({
      id: o.id,
      name: o.name,
      user_id: o.user_id,
      owner_email: emails.get(o.user_id) ?? null,
      is_legacy: o.is_legacy,
      one_line_hook: o.one_line_hook,
      created_at: o.created_at,
    })),
    total,
    hasMore: offset + oracles.length < total,
  });
}
