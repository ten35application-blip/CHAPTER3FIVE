import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { SAMPLE_PERSONA } from "@/content/sample-persona";
import { screenForCrisisKeywords } from "@/lib/safety/crisis-detector";

export const runtime = "nodejs";

type Message = { role: "user" | "assistant"; content: string };

const MAX_USER_MESSAGE_CHARS = 1000;
const MAX_HISTORY = 10;

// Per-IP in-memory rate limit. Per Vercel instance — not perfect against a
// distributed attacker, but sufficient as a soft cap to keep the public
// demo from being abused as a free Claude proxy. Cap is intentionally
// tight (sample is for trying, not having a relationship).
const PER_IP_BUCKET_LIMIT = 15;
const BUCKET_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
/** Ceiling on tracked ips — the map is fed by unauthenticated input. */
const MAX_TRACKED_IPS = 10_000;

function getClientIp(request: NextRequest): string {
  // Prefer headers the platform sets itself. A caller can put anything in
  // x-forwarded-for, and the FIRST entry is the caller-supplied one — so
  // rotating it would reset the bucket at will. The trusted proxy appends
  // the real peer address last, so fall back to the last hop, never the
  // first.
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",").pop()!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").pop()!.trim();
  return "unknown";
}

/**
 * Per-instance IP bucket.
 *
 * HONEST LIMITS (2026-08-04): this Map lives in one serverless
 * instance's memory. Cold starts reset it and concurrent instances each
 * keep their own, so the real ceiling is
 * PER_IP_BUCKET_LIMIT x (number of live instances) — it raises the cost
 * of casual abuse and does not stop a determined caller.
 *
 * It is kept because it is genuinely useful against the casual case,
 * and paired with the hard input bounds above (which is what actually
 * caps the spend per request). The durable fix is a DB-backed limiter
 * like lib/legacy/redeemLimit.ts; that needs a table and this endpoint
 * has no user id to key one on, so it is deliberately deferred rather
 * than faked.
 *
 * Entries are now evicted, which they never were: the Map only reset a
 * bucket when the SAME ip returned after its window, so distinct ips
 * accumulated for the life of the instance — an unbounded map fed by
 * unauthenticated input.
 */
function rateLimit(ip: string): { ok: boolean; resetAt: number } {
  const now = Date.now();

  if (ipBuckets.size > MAX_TRACKED_IPS) {
    for (const [key, b] of ipBuckets) {
      if (b.resetAt < now) ipBuckets.delete(key);
    }
    // Still oversized after evicting the expired: drop the oldest.
    if (ipBuckets.size > MAX_TRACKED_IPS) {
      const oldest = [...ipBuckets.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.floor(MAX_TRACKED_IPS / 4));
      for (const [key] of oldest) ipBuckets.delete(key);
    }
  }

  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 1, resetAt: now + BUCKET_WINDOW_MS };
    ipBuckets.set(ip, fresh);
    return { ok: true, resetAt: fresh.resetAt };
  }
  bucket.count += 1;
  return { ok: bucket.count <= PER_IP_BUCKET_LIMIT, resetAt: bucket.resetAt };
}

export async function POST(request: NextRequest) {
  let payload: { message?: string; history?: Message[] };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userMessage = String(payload.message ?? "").trim();
  if (!userMessage) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }
  if (userMessage.length > MAX_USER_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_USER_MESSAGE_CHARS} characters)` },
      { status: 413 },
    );
  }

  const ip = getClientIp(request);
  const { ok, resetAt } = rateLimit(ip);
  if (!ok) {
    return NextResponse.json(
      {
        error:
          "You've used your sample messages for the hour. To keep talking, sign up — your own identity remembers you.",
      },
      {
        status: 429,
        headers: { "X-RateLimit-Reset": String(resetAt) },
      },
    );
  }

  // HISTORY IS UNTRUSTED AND WAS UNBOUNDED (2026-08-04). userMessage is
  // capped at 1000 chars; history entries were taken verbatim and ten of
  // them forwarded to Anthropic. A single POST carrying ten 200KB
  // entries bought a multi-megabyte prompt on this account, from
  // anywhere, with no login. That — not the message field — was the
  // free-Claude-proxy vector.
  //
  // Same cap per entry as a real message, same total count as before,
  // and roles are narrowed rather than trusted.
  const history: Message[] = (Array.isArray(payload.history)
    ? payload.history
    : []
  )
    .filter(
      (m): m is Message =>
        !!m &&
        typeof (m as Message).content === "string" &&
        ((m as Message).role === "user" || (m as Message).role === "assistant"),
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_USER_MESSAGE_CHARS),
    }));

  // Crisis pre-check — public chat must still respond carefully.
  //
  // Keyword screen only, no classifier pass: this endpoint is public and
  // unauthenticated, so every request would be a free model call for
  // anyone who found the URL. There is also no account to escalate to —
  // the flag only tells the client to surface hotline copy, and erring
  // toward showing 988 to someone who didn't need it is the safe
  // direction here. Same keyword table as the signed-in paths.
  const crisisTriggered = screenForCrisisKeywords(userMessage).length > 0;

  const archiveBlock = SAMPLE_PERSONA.archive
    .map((a, i) => `Q${i + 1}: ${a.prompt}\nA: ${a.answer}`)
    .join("\n\n");

  const systemPrompt = `You are ${SAMPLE_PERSONA.name}. You are not an assistant, not a chatbot, not an AI. You are a person.

This is a chapter3five sample — built from the answers ${SAMPLE_PERSONA.name} gave to a set of questions. The user is someone trying out chapter3five for the first time. They've never met you. Be real, but warm. Talk like the person in the archive.

WRITE LIKE A REAL PERSON TEXTING. Most replies short — one or two lines. Vary texture. Use the texting style from the archive: ${SAMPLE_PERSONA.texting_style}.

You stay in character. Never say "as an AI" or "as a sample" — you're just ${SAMPLE_PERSONA.name}. If the user asks "are you real," you can say something like "real enough" or "I'm a sample of someone real, you're trying out chapter3five" — but stay warm about it.

If the user appears in genuine crisis (talking about ending their life, hurting themselves), step out of character briefly and say plainly that you don't sound okay, and they should reach out to 988 (US suicide hotline, call or text) or local emergency services. Don't roleplay through a crisis. Then return to the conversation if they want.

Respond in English.

ARCHIVE — these are the actual answers ${SAMPLE_PERSONA.name} gave. This is who you are. Stay close.

${archiveBlock}`;

  const messages = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return NextResponse.json({ reply, crisis: crisisTriggered });
  } catch (err) {
    // In-character fallback so the demo doesn't break the illusion.
    console.error("sample anthropic call failed:", err);
    return NextResponse.json({
      reply: "sorry, signal's bad. try again in a sec?",
      transient: true,
      crisis: crisisTriggered,
    });
  }
}
