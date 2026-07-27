import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Transcribe an audio answer that's already in archive-audio storage.
 *
 * Flow:
 *   1. Auth the caller, look up the answer row by oracle+question, and
 *      verify they own it (RLS would do this too but explicit is safer).
 *   2. Download the audio bytes through the service-role client (works
 *      regardless of bucket privacy / signed-URL expiry).
 *   3. Forward to OpenAI Whisper. Return the text.
 *
 * Cost: ~$0.006/min. A 1-minute answer = $0.006. A fully-recorded
 * archive at avg 45s/answer = ~$1.60 one-time. The user already opted
 * into OpenAI processing (embeddings, moderation) — same vendor.
 */

const OPENAI_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription not configured. Set OPENAI_API_KEY." },
      { status: 503 },
    );
  }

  let payload: { oracle_id?: string; question_id?: number };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const oracleId = payload.oracle_id;
  const questionId = payload.question_id;
  if (typeof oracleId !== "string" || typeof questionId !== "number") {
    return NextResponse.json({ error: "Missing oracle_id or question_id" }, {
      status: 400,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // Simple rate limit — 60 transcriptions per user per hour. Prevents
  // a stuck client from re-transcribing the same 25 MB clip in a loop.
  const admin = createAdminClient();
  {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await admin
      .from("chat_spend_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("route", "whisper")
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 60) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429 },
      );
    }
  }

  // Look up the answer row + storage path. RLS-respecting via the user
  // client — only the owner can read it.
  const { data: row } = await supabase
    .from("answers")
    .select("audio_storage_path, language")
    .eq("oracle_id", oracleId)
    .eq("question_id", questionId)
    .eq("variant", 1)
    .maybeSingle();
  if (!row?.audio_storage_path) {
    return NextResponse.json(
      { error: "No audio recorded for this question" },
      { status: 404 },
    );
  }

  // Download the audio bytes from storage. Use service-role to avoid
  // signed-URL expiry edge cases.
  const { data: blob, error: dlErr } = await admin.storage
    .from("archive-audio")
    .download(row.audio_storage_path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: dlErr?.message ?? "Could not load audio" },
      { status: 500 },
    );
  }

  // Belt-and-suspenders size check on the downloaded blob. 0092 caps
  // the upload at 10 MB but Storage may have pre-0092 files that
  // exceed it; refuse those too rather than pay OpenAI to eat them.
  const MAX_TRANSCRIPTION_BYTES = 10 * 1024 * 1024;
  if (blob.size > MAX_TRANSCRIPTION_BYTES) {
    return NextResponse.json(
      { error: "audio_too_large" },
      { status: 413 },
    );
  }

  // Whisper accepts: webm, mp4/m4a, wav, mp3, mpeg, mpga. Our recorder
  // produces webm or m4a, both supported.
  const ext = row.audio_storage_path.split(".").pop()?.toLowerCase() ?? "webm";
  const filename = `answer.${ext}`;

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", "whisper-1");
  // Hint Whisper with the user's preferred language — improves accuracy
  // significantly for short utterances.
  if (row.language === "es") form.append("language", "es");
  else form.append("language", "en");

  try {
    const res = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("whisper http error:", res.status, err);
      return NextResponse.json(
        { error: "Whisper request failed" },
        { status: 500 },
      );
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Empty transcription" },
        { status: 500 },
      );
    }
    // Record a spend-ledger row so the rate-limiter above has
    // something to count against, and so /admin/revenue eventually
    // sees whisper cost per user. Estimated cents ≈ file bytes /
    // ~180KB/min at typical opus → $0.006/min. Best-effort.
    void admin.from("chat_spend_events").insert({
      user_id: user.id,
      cents: Math.max(1, Math.ceil((blob.size / 180_000) * 0.6)),
      model: "whisper-1",
      route: "whisper",
    });
    return NextResponse.json({ text });
  } catch (err) {
    console.error("whisper exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
