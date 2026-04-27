import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  questions,
  eligibleAnswerIndexes,
  type GenderFilter,
} from "@/content/questions";
import { pickPersonality, pickFlavor } from "@/content/personality";

/**
 * Mobile-friendly randomize endpoint. Mirrors the web server action at
 * /onboarding/randomize but accepts Bearer auth so React Native can call it.
 */
export async function POST(request: NextRequest) {
  let payload: { gender?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const genderRaw = String(payload.gender ?? "any");
  const gender: GenderFilter =
    genderRaw === "female" || genderRaw === "male" ? genderRaw : "any";

  // Resolve user from cookie OR Authorization: Bearer header.
  const supabase = await createClient();
  let { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const auth = request.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const tokenClient = createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${m[1]}` } } },
      );
      const r = await tokenClient.auth.getUser(m[1]);
      user = r.data.user ?? null;
    }
  }
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "preferred_language, mode, active_oracle_id, randomize_credits, randomize_count",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }
  if (!profile.active_oracle_id) {
    return NextResponse.json({ error: "No active identity" }, { status: 400 });
  }
  if ((profile.randomize_credits ?? 0) <= 0) {
    return NextResponse.json(
      { error: "No randomize credits", needsPayment: true },
      { status: 402 },
    );
  }

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const oracleId = profile.active_oracle_id;

  const rows = questions
    .filter((q) => q.randomizeOptions && q.randomizeOptions[language]?.length)
    .map((q) => {
      const options = q.randomizeOptions[language];
      const allowed = eligibleAnswerIndexes(options.length, gender);
      if (allowed.length === 0) return null;
      const idx = allowed[Math.floor(Math.random() * allowed.length)];
      return {
        user_id: user!.id,
        oracle_id: oracleId,
        question_id: q.id,
        language,
        variant: 1,
        body: options[idx],
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No answers match" }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from("answers")
    .upsert(rows, { onConflict: "oracle_id,question_id,variant" });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase
    .from("profiles")
    .update({
      personality_type: pickPersonality(),
      emotional_flavor: pickFlavor(),
      randomize_credits: Math.max(0, (profile.randomize_credits ?? 0) - 1),
      randomize_count: (profile.randomize_count ?? 0) + 1,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
