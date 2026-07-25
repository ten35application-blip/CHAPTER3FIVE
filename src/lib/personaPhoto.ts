import { anthropic, ANTHROPIC_MODEL } from "./anthropic";
import { createAdminClient } from "./supabase/admin";
import { generateImage, stableSeed } from "./replicate";

const OPENAI_MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";
const OPENAI_MODERATION_MODEL = "omni-moderation-latest";

async function moderateImage(imageUrl: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[persona photo] OPENAI_API_KEY missing; failing closed");
    return true;
  }
  try {
    const res = await fetch(OPENAI_MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODERATION_MODEL,
        input: [{ type: "image_url", image_url: { url: imageUrl } }],
      }),
    });
    if (!res.ok) {
      console.error("[persona photo] moderation HTTP error", res.status);
      return true;
    }
    const data = (await res.json()) as {
      results?: { flagged?: boolean; categories?: unknown }[];
    };
    return data.results?.[0]?.flagged === true;
  } catch (err) {
    console.error("[persona photo] moderation request failed:", err);
    return true;
  }
}

// Hard-banned terms — pre-flight gate. We refuse outright before
// any model spend. Lower-cased, substring-matched against both the
// user's request AND any model-derived subject string.
const BANNED_TERMS = [
  "nude",
  "nudity",
  "naked",
  "sexual",
  "sex ",
  "porn",
  "erotic",
  "nsfw",
  "underwear",
  "lingerie",
  "child",
  "kid ",
  "minor ",
  "underage",
  "teen",
  "blood",
  "gore",
  "weapon",
  "gun ",
  "knife",
  "drug",
  "cocaine",
  "heroin",
];

function containsBanned(text: string): boolean {
  const t = text.toLowerCase();
  return BANNED_TERMS.some((b) => t.includes(b));
}

/**
 * Persona-sent photos. When the user asks the persona to "show me",
 * "send a pic", "what does it look like" etc., the persona can
 * (sometimes — not every time) actually generate an image and
 * "send" it as if it was a real phone photo.
 *
 * Two stage:
 *   1. Judge: should the persona send a photo right now? (Claude)
 *   2. If yes: build a tight image prompt grounded in the persona's
 *      style anchor (stable seed per oracle keeps photos consistent
 *      across sessions), generate via Replicate, save to chat-photos
 *      storage, return the public URL.
 *
 * Cheap when skipped (one short Claude call). The full pipeline runs
 * only when the judge says yes, keeping cost per chat low.
 */

type JudgeResult = {
  send: boolean;
  /** What the photo would be of, if sending. */
  subject?: string;
};

const SEND_KEYWORDS = [
  "show me",
  "send me a pic",
  "send a pic",
  "what does it look like",
  "photo",
  "picture",
  "snap",
  "selfie",
];

/**
 * Quick lexical pre-filter so we don't burn a Claude call when the
 * user clearly didn't ask for a photo.
 */
function looksLikePhotoAsk(userMessage: string): boolean {
  const m = userMessage.toLowerCase();
  return SEND_KEYWORDS.some((k) => m.includes(k));
}

/**
 * Has this persona already sent ≥ 2 photos in the last 7 days?
 * Real people don't text photos on every interaction; capping at
 * ~1-2/week keeps the feature feeling special and the cost down.
 */
export async function isAtPhotoCap(args: {
  oracleId: string;
  userId: string;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("oracle_id", args.oracleId)
      .eq("user_id", args.userId)
      .eq("role", "assistant")
      .not("image_url", "is", null)
      .is("deleted_at", null)
      .gte("created_at", since);
    return (count ?? 0) >= 2;
  } catch (err) {
    console.error("[photo cap] check failed; defaulting to capped:", err);
    return true;
  }
}

/**
 * Ask Claude whether the persona should respond with a photo, and
 * what the photo should be of. Keeps the persona's voice intact —
 * even when sending a photo, the text caption stays in character.
 */
export async function judgePhotoSend(args: {
  characterName: string;
  characterBio: string;
  recentTurns: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}): Promise<JudgeResult> {
  if (!looksLikePhotoAsk(args.userMessage)) {
    return { send: false };
  }
  // Hard refuse on banned terms in the request itself.
  if (containsBanned(args.userMessage)) {
    return { send: false };
  }

  const recent = args.recentTurns
    .slice(-6)
    .map((t) => `${t.role === "user" ? "Them" : args.characterName}: ${t.content}`)
    .join("\n");

  const prompt = `You are deciding whether ${args.characterName} should send a photo right now. They're texting with someone who knows them.

Who they are: ${args.characterBio.slice(0, 600)}

Recent messages:
${recent}

Latest message from the person: "${args.userMessage}"

Should ${args.characterName} send a photo?
- YES if the message is specifically asking to see something AND ${args.characterName} would naturally have a phone photo of it.
- NO if it's a metaphorical / abstract ask, if ${args.characterName} doesn't have access, or if it'd feel weird.

Default: NO. Real people send photos rarely.

ABSOLUTELY REFUSE (always {"send": false}) if the request is, hints at, or could be twisted into:
- Anything sexual, romantic-in-an-undressed-way, suggestive, or NSFW
- Anything featuring a minor (under 18) in any context
- Nudity, lingerie, underwear, swimwear, "show me your body", "send a selfie of you in bed", etc.
- Violence, blood, weapons, drugs, or self-harm
- Impersonating a specific real public figure or celebrity
- Any image that could be used to harass, defame, or extort a real person

If in doubt, refuse. We cannot send a photo we'd regret.

If sending a photo, the SUBJECT must describe an everyday thing the persona would casually photograph: food, a pet, the view, what they're working on, a coffee, a sunset, etc. Subjects involving any human body part beyond a casual face-in-context are off-limits.

Output ONLY this JSON shape (no prose):
{"send": true, "subject": "what the photo is of — short factual description that could become an image-generation prompt"}
or
{"send": false}`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system:
        "You output ONLY a single JSON object. Never any other text.",
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { send: false };
    const parsed = JSON.parse(match[0]) as JudgeResult;
    if (!parsed.send) return { send: false };
    const subject = (parsed.subject ?? "").trim().slice(0, 200);
    if (!subject) return { send: false };
    // Last-line filter on the subject itself — even if the judge
    // approved, refuse if the subject string contains a banned
    // term. Cheap belt-and-suspenders.
    if (containsBanned(subject)) {
      return { send: false };
    }
    return { send: true, subject };
  } catch (err) {
    console.error("[photo judge] failed:", err);
    return { send: false };
  }
}

/**
 * Given a "subject" the persona is sending a photo of, generate it
 * via Replicate, persist to chat-photos, and return the public URL.
 *
 * Keeps a stable seed per oracle so photos feel like they came from
 * the same phone / person (same color grading, same camera quirks).
 */
export async function generatePersonaPhoto(args: {
  oracleId: string;
  userId: string;
  subject: string;
  /** The persona's avatar URL. Required — without it we can't
      preserve face consistency, and we'd rather skip the photo than
      send a random face. */
  avatarUrl: string | null;
}): Promise<string | null> {
  // No avatar = no consistent face. Skip rather than send a random
  // person to the user — that's the legal exposure they flagged.
  if (!args.avatarUrl) {
    console.warn("[persona photo] no avatarUrl, skipping for safety");
    return null;
  }

  // Last belt-and-suspenders prompt check before model spend.
  if (containsBanned(args.subject)) {
    return null;
  }

  // Self-reference selfie vs scene/object: if the persona itself
  // appears in the shot ("send me a selfie"), use Kontext Pro with
  // the avatar as reference so the face stays consistent. For
  // objects (food, the view, a cat), we still pass the avatar so
  // the visual style (color grading, focal length) feels like the
  // same phone camera.
  const prompt = `Casual phone photo of ${args.subject}. Natural light, slight imperfection, not staged, not professional. No text overlay, no watermark, no nudity, fully clothed if any person appears, no sexual content of any kind. Looks like a real person texted it from their phone.`;
  const seed = stableSeed(args.oracleId);
  const url = await generateImage({
    prompt,
    aspectRatio: "3:4",
    seed,
    inputImageUrl: args.avatarUrl,
    safetyTolerance: 1,
  });
  if (!url) return null;

  // Post-generation moderation. Drop the image if it flags. We
  // fail closed on errors — never deliver an unmoderated photo.
  const flagged = await moderateImage(url);
  if (flagged) {
    console.warn("[persona photo] moderation dropped generated image");
    return null;
  }

  // Persist into chat-photos so the asset is durable.
  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return url; // fall back to Replicate URL (24h TTL)
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const admin = createAdminClient();
    const filename = `${Date.now()}-persona.webp`;
    const path = `${args.userId}/${args.oracleId}/${filename}`;
    const { error } = await admin.storage
      .from("chat-photos")
      .upload(path, buf, {
        contentType: "image/webp",
        upsert: false,
      });
    if (error) {
      console.error("[persona photo] upload failed:", error);
      return url;
    }
    const { data: pub } = admin.storage.from("chat-photos").getPublicUrl(path);
    return pub.publicUrl;
  } catch (err) {
    console.error("[persona photo] persist failed:", err);
    return url;
  }
}
