import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { safeCount, safeSelect } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/identities/[id] — JSON twin of /admin/identities/[id]:
 * the guts of one identity. Creator email comes from the GoTrue admin
 * API. The persona prompt ships as the same 1,200-char preview the web
 * page renders plus its full length (the full text stays server-side —
 * mobile shows the preview + count, exactly like web). Also includes
 * message_count and legacy_answers for the mobile detail screen.
 */
type OracleDetail = {
  id: string;
  name: string;
  user_id: string;
  is_legacy: boolean | null;
  one_line_hook: string | null;
  fingerprint: string | null;
  traits: Record<string, unknown> | null;
  persona_prompt: string | null;
  bio: string | null;
  legacy_answers: unknown;
  created_at: string;
};

const PROMPT_PREVIEW_CHARS = 1200;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;
  const { id } = await params;

  const rows = await safeSelect<OracleDetail>(
    supabase,
    "oracles",
    "id, name, user_id, is_legacy, one_line_hook, fingerprint, traits, persona_prompt, bio, legacy_answers, created_at",
    (q) => q.eq("id", id),
  );
  const oracle = rows[0];
  if (!oracle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: creator }, messageCount] = await Promise.all([
    supabase.auth.admin.getUserById(oracle.user_id),
    safeCount(supabase, "messages", (q) => q.eq("oracle_id", id)),
  ]);
  const creatorEmail = creator?.user?.email ?? null;

  const prompt = oracle.persona_prompt ?? "";
  const promptPreview =
    prompt.length > PROMPT_PREVIEW_CHARS
      ? `${prompt.slice(0, PROMPT_PREVIEW_CHARS)}…`
      : prompt;

  return NextResponse.json({
    identity: {
      id: oracle.id,
      name: oracle.name,
      user_id: oracle.user_id,
      is_legacy: oracle.is_legacy,
      one_line_hook: oracle.one_line_hook,
      fingerprint: oracle.fingerprint,
      traits: oracle.traits,
      bio: oracle.bio,
      legacy_answers: oracle.legacy_answers ?? null,
      created_at: oracle.created_at,
    },
    owner_email: creatorEmail,
    persona_prompt: {
      preview: promptPreview,
      preview_chars: PROMPT_PREVIEW_CHARS,
      length: prompt.length,
    },
    message_count: messageCount,
  });
}
