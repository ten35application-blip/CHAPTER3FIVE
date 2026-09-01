import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set([
  "companion",
  "pro_month",
  "message_pack",
  "image_pack",
  "inherit_credit",
]);

/**
 * /api/admin/rewards — the mobile twin of /admin/rewards (web page
 * uses server actions; the phone needs REST). Same rules, one brain:
 * a single campaign at a time, next-N-signups, self-exhausting.
 *
 *   GET  → { running, past }
 *   POST { action:"start", quota, kind, label? }
 *   POST { action:"stop", id }
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const { data } = await gate.admin
    .from("signup_promos")
    .select("id, label, kind, quota, claimed, enabled, starts_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const promos = data ?? [];
  return NextResponse.json({
    running: promos.find((p) => p.enabled) ?? null,
    past: promos.filter((p) => !p.enabled),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    quota?: number;
    kind?: string;
    label?: string;
    id?: string;
  };

  if (body.action === "stop") {
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await gate.admin
      .from("signup_promos")
      .update({ enabled: false })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "start") {
    const quota = Math.floor(Number(body.quota));
    const kind = String(body.kind ?? "companion");
    if (!Number.isFinite(quota) || quota < 1 || quota > 10000) {
      return NextResponse.json({ error: "quota must be 1-10000" }, { status: 400 });
    }
    if (!KINDS.has(kind)) {
      return NextResponse.json({ error: "unknown kind" }, { status: 400 });
    }
    await gate.admin
      .from("signup_promos")
      .update({ enabled: false })
      .eq("enabled", true);
    const { data, error } = await gate.admin
      .from("signup_promos")
      .insert({
        label:
          (body.label ?? "").trim() ||
          `${quota} free ${kind === "companion" ? "identities" : kind}`,
        kind,
        quota,
        enabled: true,
        created_by: gate.user.id,
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, running: data });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
