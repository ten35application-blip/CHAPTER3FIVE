import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage, stableSeed } from "@/lib/replicate";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate an AI portrait for an identity, save it to the avatars
 * bucket, and set oracles.avatar_url.
 *
 * Only allowed for the OWNER, and only for randomize / memory mode
 * — real-mode identities should use a real photo (their own or the
 * person they're recording). Memory-mode portraits are explicitly
 * labeled in the UI as a likeness, not the person.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: oracleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, user_id, mode, name, bio, memory_seed")
    .eq("id", oracleId)
    .maybeSingle();

  if (!oracle || oracle.user_id !== user.id) {
    return NextResponse.json({ error: "Not your identity" }, { status: 404 });
  }
  if (oracle.mode !== "randomize" && oracle.mode !== "memory") {
    return NextResponse.json(
      {
        error:
          "Generated portraits are only available for randomized or memory-mode identities.",
      },
      { status: 400 },
    );
  }

  // Build a prompt from the bio / memory seed. We DON'T try to match
  // a specific real person's face — we describe a vibe + style. The
  // user has to opt in to a generated likeness, and we surface "this
  // is not them — a face the AI drew" everywhere it shows.
  const bioBlock = (oracle.bio ?? "").slice(0, 1200);
  const seedBlock = (oracle.memory_seed ?? "").slice(0, 1500);

  const promptHint =
    oracle.mode === "memory"
      ? `Draw a warm, naturalistic portrait that captures the SPIRIT of the person described — age range, general energy, style of dress. DO NOT attempt to recreate a specific real human face. The image should feel like a candid phone photo, not a studio portrait or illustration. Natural light, soft expression, neutral background.

Person:
${seedBlock || bioBlock || oracle.name || "an adult"}`
      : `Draw a candid portrait of an imagined adult who matches this brief description. The image should feel like a casual phone photo — natural light, soft expression, neutral background.

Person:
${bioBlock || oracle.name || "an adult"}`;

  const seed = stableSeed(oracle.id);
  const url = await generateImage({
    prompt: promptHint,
    aspectRatio: "1:1",
    seed,
  });
  if (!url) {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }

  // Download from Replicate (24h URL) and persist to our avatars
  // bucket so the asset is durable.
  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    return NextResponse.json({ error: "Could not fetch generated image" }, { status: 500 });
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const admin = createAdminClient();
    // UNGUESSABLE PATH (2026-08-04). This used to be a deterministic key.
  // The `avatars` bucket is PUBLIC — objects are served with no auth at
  // all — so anyone who could compute the key could fetch the image.
  // The key was {user_id}/{millisecond timestamp}-ai.webp. This one is a
  // generated face rather than a photograph, so the stakes are lower —
  // but there is no reason to leave it enumerable.
  // A random component makes the URL a capability: it works if you were
  // given it, and is not derivable from anything a person might see.
  // Nothing re-derives this key — it is written to oracles.avatar_url
  // once and read from there forever, including by the purge cron.
const filename = `${randomUUID()}-ai.webp`;
  const path = `${user.id}/${filename}`;

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, buf, {
      contentType: "image/webp",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: pub } = admin.storage.from("avatars").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  await supabase
    .from("oracles")
    .update({ avatar_url: publicUrl })
    .eq("id", oracleId)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, url: publicUrl });
}
