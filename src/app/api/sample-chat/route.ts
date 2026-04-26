import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { SAMPLE_PERSONA } from "@/content/sample-persona";
import { detectCrisis } from "@/lib/crisis";

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

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimit(ip: string): { ok: boolean; resetAt: number } {
  const now = Date.now();
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
          "You've used your sample messages for the hour. To keep talking, sign up — your own thirtyfive remembers you.",
      },
      {
        status: 429,
        headers: { "X-RateLimit-Reset": String(resetAt) },
      },
    );
  }

  const history = Array.isArray(payload.history) ? payload.history : [];

  // Crisis pre-check — public chat must still respond carefully.
  const crisis = detectCrisis(userMessage);

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
    ...history.slice(-MAX_HISTORY).map((m) => ({
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

    return NextResponse.json({ reply, crisis: crisis.triggered });
  } catch (err) {
    // In-character fallback so the demo doesn't break the illusion.
    console.error("sample anthropic call failed:", err);
    return NextResponse.json({
      reply: "sorry, signal's bad. try again in a sec?",
      transient: true,
      crisis: crisis.triggered,
    });
  }
}
