import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSaveFace } from "@/lib/faces/generate";
import {
  rollTraits,
  distinctiveValuesFromTraits,
  type Traits,
} from "@/lib/identity/formula";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import { synthesizePersona } from "@/lib/identity/synthesize";
import { recordAudit } from "@/lib/notifications";

export const runtime = "nodejs";
// The companion gift runs the full roll → synthesize → face pipeline
// (~60-90s) — same ceiling as identity creation.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/gifts/claim { gift_id } — the user pressed OK on the gift
 * moment; NOW it lands. Claim-first (atomic stamp on claimed_at) so a
 * double-tap or a replay can never grant twice; if the grant fails
 * after the claim, the stamp is rolled back so OK can be pressed
 * again. Grants run service-role — the same levers the admin's
 * instant actions use:
 *   pro_month      → pro_until +30d, plan_source 'admin_grant'
 *   message_pack   → +100 message credits
 *   image_pack     → +12 image credits
 *   inherit_credit → +1 inherited_slot_credits
 *   companion      → a formula companion stamped is_referral_reward
 *                    (talkable on Free, outside quota — the referral
 *                    reward's exact shape, minted by the house)
 */
export async function POST(request: NextRequest) {
  let body: { gift_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const giftId = typeof body.gift_id === "string" ? body.gift_id : null;
  if (!giftId) {
    return NextResponse.json({ error: "gift_id required" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
  const supabase = bearer
    ? createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearer}` } } },
      )
    : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(bearer ?? undefined);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Atomic claim: stamp claimed_at only if unclaimed AND owned by the
  // caller. Zero rows back = already claimed or not theirs.
  const { data: claimed } = await admin
    .from("admin_gifts")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", giftId)
    .eq("user_id", user.id)
    .is("claimed_at", null)
    .select("id, kind");
  const gift = claimed?.[0];
  if (!gift) {
    return NextResponse.json(
      { error: "Gift already claimed or not found.", code: "gone" },
      { status: 409 },
    );
  }

  const unclaim = async () => {
    await admin
      .from("admin_gifts")
      .update({ claimed_at: null })
      .eq("id", giftId);
  };

  try {
    switch (gift.kind) {
      case "pro_month": {
        const { data: existing } = await admin
          .from("profiles")
          .select("pro_until")
          .eq("id", user.id)
          .maybeSingle<{ pro_until: string | null }>();
        const base = existing?.pro_until
          ? Math.max(Date.now(), new Date(existing.pro_until).getTime())
          : Date.now();
        const until = new Date(base + 30 * 24 * 3600 * 1000).toISOString();
        const { error } = await admin
          .from("profiles")
          .update({ pro_until: until, plan_source: "admin_grant" })
          .eq("id", user.id);
        if (error) throw error;
        break;
      }
      case "message_pack": {
        const { error } = await admin.rpc("increment_profile_counter", {
          target_user_id: user.id,
          counter_name: "message_credits",
          delta: 100,
        });
        if (error) throw error;
        break;
      }
      case "image_pack": {
        const { error } = await admin.rpc("increment_profile_counter", {
          target_user_id: user.id,
          counter_name: "image_credits",
          delta: 12,
        });
        if (error) throw error;
        break;
      }
      case "inherit_credit": {
        const { error } = await admin.rpc("increment_profile_counter", {
          target_user_id: user.id,
          counter_name: "inherited_slot_credits",
          delta: 1,
        });
        if (error) throw error;
        break;
      }
      case "companion": {
        // The referral reward's exact creation path (mirrored from
        // /api/referral/redeem): fingerprint-deduped roll, synthesis,
        // is_referral_reward stamp (talkable on Free, outside quota),
        // face painted before reveal.
        const { data: sibRows } = await admin
          .from("oracles")
          .select("traits")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .limit(40);
        const avoidDistinctive = distinctiveValuesFromTraits(
          (sibRows ?? []).map((r) => r.traits),
        );
        let traits: Traits | null = null;
        let fingerprint: string | null = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const candidate = rollTraits({ avoidDistinctive });
          const candidateFingerprint = fingerprintTraits(candidate);
          const { data: existing } = await admin
            .from("oracles")
            .select("id")
            .eq("fingerprint", candidateFingerprint)
            .maybeSingle();
          if (!existing) {
            traits = candidate;
            fingerprint = candidateFingerprint;
            break;
          }
        }
        if (!traits || !fingerprint) throw new Error("fingerprint exhaustion");
        const persona = await synthesizePersona(traits);
        const { data: inserted, error: insertError } = await admin
          .from("oracles")
          .insert({
            user_id: user.id,
            created_by: user.id,
            traits,
            fingerprint,
            name: persona.name,
            one_line_hook: persona.one_line_hook,
            persona_prompt: persona.persona_prompt,
            significant_events: persona.significant_events,
            disclosure_pace: traits.disclosurePace ?? null,
            silence_style: traits.silenceStyle ?? null,
            punctuation_habit: traits.punctuationHabit ?? null,
            memory_style: traits.memoryStyle ?? null,
            text_burst_style: traits.textBurstStyle ?? null,
            chronotype: traits.chronotype ?? null,
            voice_examples: persona.voice_examples,
            texting_fluency: traits.textingFluency ?? null,
            pet_name: persona.pet_name ?? null,
            creation_source: "random",
            is_referral_reward: true,
            provisioning: true,
          })
          .select("id")
          .single<{ id: string }>();
        if (insertError || !inserted)
          throw insertError ?? new Error("insert failed");
        for (let attempt = 0; attempt < 2; attempt++) {
          const face = await generateAndSaveFace(inserted.id, traits);
          if (face.ok) break;
          console.error("[gifts/claim] face gen attempt failed:", face.error);
        }
        await admin
          .from("oracles")
          .update({ provisioning: false })
          .eq("id", inserted.id);
        break;
      }
      default:
        throw new Error(`unknown gift kind ${gift.kind}`);
    }
  } catch (err) {
    await unclaim();
    console.error("[gifts/claim] grant failed:", err);
    return NextResponse.json(
      { error: "The gift couldn't be applied — try OK again in a moment." },
      { status: 500 },
    );
  }

  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "gift_claimed",
    targetUserId: user.id,
    targetId: giftId,
    details: { kind: gift.kind },
  });
  return NextResponse.json({ ok: true, kind: gift.kind });
}
