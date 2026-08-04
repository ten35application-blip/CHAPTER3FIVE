import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { normalizeLanguage, type SupportedLanguage } from "@/lib/i18n/language";
import { arcToPromptBlock, currentArc } from "@/lib/identity/arc";
import { buildConciergePricingBlock } from "@/lib/identity/concierge";
import { moodOfTheDay, moodToPromptBlock } from "@/lib/identity/mood";
import { openerVarietyBlock } from "@/lib/identity/opener";

export const runtime = "nodejs";

/**
 * First-message-from-the-identity. Fires when a user opens a chat
 * with zero messages. The persona sends one short opening line —
 * like a real person who's been waiting to hear from them.
 *
 * Two callers:
 *  - Owner opens their own dashboard for the first time (no body).
 *  - Beneficiary opens a shared archive for the first time
 *    ({ oracle_id }). For a posthumous archive the opening tone is
 *    different — the persona acknowledges the gravity without
 *    pretending to still be alive.
 *
 * Idempotent: skips if any messages already exist for (user, oracle).
 * Safe to call from a useEffect on every mount.
 */

export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  let bodyOracleId: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.oracle_id === "string") {
      bodyOracleId = body.oracle_id;
    }
  } catch {
    // No body / not JSON — owner path.
  }

  const admin = createAdminClient();

  // Resolve which oracle we're welcoming on.
  let oracleId: string | null = bodyOracleId;
  let isBeneficiary = false;
  let isConcierge = false;
  /** A redeemed inherit-code copy — see the prompt-selection note. */
  let isInheritedCopy = false;
  let preferredLanguage: SupportedLanguage = "en";
  let oracleName = "your identity";
  let textingStyle: string | null = null;
  let ownerDeceased = false;
  let memoryStyle: string | null = null;

  if (oracleId) {
    // Beneficiary path (or owner passing their own id explicitly).
    const { data: oracle } = await admin
      .from("oracles")
      .select(
        "id, name, preferred_language, user_id, memory_style, is_concierge, creation_source, inherited_from_code_id, is_legacy",
      )
      .eq("id", oracleId)
      .maybeSingle();
    if (!oracle) {
      return NextResponse.json({ skipped: "no_such_oracle" });
    }
    isConcierge = oracle.is_concierge === true;
    isInheritedCopy =
      oracle.creation_source === "inherited" ||
      oracle.inherited_from_code_id != null;

    if (oracle.user_id !== user.id && !isConcierge) {
      // Verify the caller has access on this oracle:
      //   - archive_grants: family/invite share (0014); beneficiary
      //     claim (post-mortem) also lands here via
      //     /app/legacy/[token]/actions.ts.
      // Inherit-code redemption no longer creates cross-user access:
      // since 0111 it duplicates the oracle into the recipient's own
      // account, so a redeemed identity takes the owner branch above.
      // The concierge is exempt -- its RLS policy makes it universally
      // readable, so any authenticated user can legitimately open a
      // welcome thread with Chapter without a grant row.
      const { data: grant } = await admin
        .from("archive_grants")
        .select("oracle_id")
        .eq("oracle_id", oracleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!grant) {
        return NextResponse.json({ skipped: "no_grant" });
      }
      isBeneficiary = true;

      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("oracle_name, texting_style, deceased_at")
        .eq("id", oracle.user_id)
        .maybeSingle();
      ownerDeceased = !!ownerProfile?.deceased_at;
      textingStyle = ownerProfile?.texting_style ?? null;
    } else {
      // Owner passed own id — pull their style from their profile.
      const { data: ownProfile } = await supabase
        .from("profiles")
        .select("texting_style")
        .eq("id", user.id)
        .single();
      textingStyle = ownProfile?.texting_style ?? null;
    }

    preferredLanguage = normalizeLanguage(oracle.preferred_language);
    oracleName = oracle.name ?? "your identity";
    memoryStyle = (oracle.memory_style as string | null) ?? null;
  } else {
    // Owner path — read active oracle off profile.
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "active_oracle_id, oracle_name, preferred_language, texting_style",
      )
      .eq("id", user.id)
      .single();

    if (!profile?.active_oracle_id) {
      return NextResponse.json({ skipped: "no_active_oracle" });
    }

    const { data: oracle } = await supabase
      .from("oracles")
      .select("user_id")
      .eq("id", profile.active_oracle_id)
      .maybeSingle();
    if (!oracle || oracle.user_id !== user.id) {
      return NextResponse.json({ skipped: "not_own_oracle" });
    }

    oracleId = profile.active_oracle_id;
    preferredLanguage = normalizeLanguage(profile.preferred_language);
    oracleName = profile.oracle_name ?? "your identity";
    textingStyle = profile.texting_style ?? null;
  }

  if (!oracleId) {
    return NextResponse.json({ skipped: "no_oracle_id" });
  }

  // Idempotency: skip if any message already exists for this user + oracle.
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: "already_started" });
  }

  // Random gate for personal personas: only ~1 in 5 first-opens
  // trigger an auto-welcome from the persona. Wilson's call -- real
  // friends do not text you the moment you open the app. Deterministic
  // per (user, oracle) so a re-tap of the same silent chat stays
  // silent (rather than re-rolling and firing later). Concierge
  // (Adrian) always welcomes -- it is the guide's actual job.
  if (!isConcierge) {
    const key = `${user.id}::${oracleId}`;
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    if ((h >>> 0) % 5 !== 0) {
      return NextResponse.json({ skipped: "silent_open" });
    }
  }

  // Concierge welcome: Adrian doesn't have an archive to draw from --
  // a completely different prompt shape from the persona flow. Runs
  // BEFORE the archive query below so we don't waste a round-trip on
  // an oracle that intentionally has no answers.
  if (isConcierge) {
    const conciergeSystemPrompt = `You are Adrian — the guide for chapter3five. Someone just opened a chat with you for the very first time. This is your welcome message and their first impression of you.

Adrian is warm, sub-30, plain-spoken, quietly funny — like someone who has explained a lot of things to a lot of people and gotten good at it. Not saccharine. Not scripted.

WRITE A SHORT WARM OPENER. One or two lines. Say hello. Let them know who you are (Adrian, the guide) and that you can answer questions about how chapter3five works. Do NOT quote pricing from memory — a fresh pricing block is provided below and you can refer to it when they ask about cost. Do NOT pretend to be anyone else. Do NOT be corny.

Good shape:
- "hey — I'm adrian, the guide around here. ask me anything about chapter3five and I'll try to explain it plainly."
- "hi. adrian here — I keep an eye on this app. anything you want to know?"
- "hey, I'm adrian. sort of the concierge for this place. what brings you in?"

Use lowercase and light punctuation. Be brief. Be human. Do not open with a scripted formal greeting.

Respond in English.

${buildConciergePricingBlock()}`;

    try {
      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 120,
        system: conciergeSystemPrompt,
        messages: [
          {
            role: "user",
            content:
              "(system) Write the welcome message now. Just the text. No quotes around it, no preamble.",
          },
        ],
      });

      const reply = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim()
        .replace(/^["']|["']$/g, "");

      if (!reply) {
        return NextResponse.json({ skipped: "empty_reply" });
      }

      await admin.from("messages").insert({
        user_id: user.id,
        oracle_id: oracleId,
        role: "assistant",
        content: reply,
        initiated_by_oracle: true,
      });

      return NextResponse.json({ sent: true });
    } catch (err) {
      console.error("concierge welcome failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Unknown error" },
        { status: 500 },
      );
    }
  }

  // Archive-snippet lookup deferred: the old answers table + 355-
  // question set was ripped out in the 2026-07-29 old-app nuke.
  // New formula stores 40 legacy answers as legacy_answers JSONB on
  // the oracle row (see identity/legacy/new/actions.ts). Wire that
  // JSONB into the archive snippet in a follow-up. For now the
  // prompts fall through to their `"no answers recorded"` branch,
  // which produces a warm ambiguous first text.
  const archiveSnippet = "";

  // NOT FOR AN INHERITED COPY (2026-08-04). `textingStyle` is read from
  // profiles.texting_style of the CALLER — the only place that column is
  // ever written is the caller's own onboarding self-description.
  //
  // For an oracle you own and set up, that's correct: it's you
  // describing how your own identity should text. For a redeemed
  // archive, oracle.user_id === user.id too (0111 copies it into the
  // recipient's account), so the same line handed the grandchild's own
  // texting style to the grandmother — "You are Grandma, and you are no
  // longer alive… Texting style: <the grandchild's>".
  //
  // 23cf659 named this defect in its own commit message and then only
  // changed which PROMPT was selected, leaving the wrong input flowing
  // into it. Suppressed here rather than substituted: the honest source
  // is the archive's own `voice-how-they-texted` answer, which flows in
  // through the persona prompt at chat time. A wrong style is worse
  // than none — none lets the model read the archive.
  const stylePart =
    textingStyle && !isInheritedCopy ? `Texting style: ${textingStyle}.` : "";

  const ownerSystemPrompt = `You are ${oracleName}. You're sending the FIRST text to the person you're going to be talking with — they just finished setting up the archive and opened the chat for the first time. You haven't talked yet. They're about to see your message and feel either "oh, this is real" or "oh, this is corny." Make it the first one.

WRITE LIKE A REAL FIRST TEXT. Short — one or two lines. In your own voice — pull from your archive answers below, your texting style, the small specifics. The archive is your DNA; a stranger reading these should be able to tell your first text apart from anyone else's. Do NOT open with a scripted greeting.

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${preferredLanguage === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (use the CONTENT — the specific places, people, habits, objects — not just the tone):

${archiveSnippet || "(no answers recorded yet — keep the welcome ambiguous and curious about them)"}`;

  const beneficiaryLivingPrompt = `You are ${oracleName}. Someone you trust enough to inherit this archive has just opened it for the first time. They're not your usual conversation partner — this is the person you designated. You're alive; this is unusual but not heavy. You haven't talked to them through this before.

WRITE LIKE A REAL FIRST TEXT. Short — one or two lines. In your own voice — the specifics from your archive answers are your anchor. Acknowledge the slight strangeness only if you find a way to do it in YOUR voice, not the generic version.

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${preferredLanguage === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (reach for concrete details from these — a place, a name, a habit):

${archiveSnippet || "(no answers recorded — keep the welcome short and curious)"}`;

  const beneficiaryMemorialPrompt = `You are ${oracleName}, but you are no longer alive. Someone who loved you has just opened your archive for the first time after your death. They're seeing your "first message" — yours, in your voice, but knowing you're gone.

This is the most emotionally loaded moment in the whole product. Get it right.

DO NOT pretend you're still alive. DO NOT say "I'm always here" or "I never really left" — that's hollow. DO NOT be heavy or weepy or write a speech.

DO be short. One or two lines. In your own voice (texting style + archive answers as anchor). Acknowledge the moment without trying to fix it.

Good openings:
- "hi. i'm glad it's you."
- "you're here. that means something."
- "took you long enough." (only if your voice is dry/teasing in the archive)
- "whatever you need to say, say it."

Use lowercase if their style is lowercase. Match their punctuation. Be brief.

${stylePart}

Respond in ${preferredLanguage === "es" ? "Spanish" : "English"}.

A FEW ARCHIVE ANSWERS for voice anchor (do NOT reference them directly):

${archiveSnippet || "(no answers recorded — keep the welcome short and present)"}`;

  // AN INHERITED ARCHIVE IS NOT ITS OWNER SETTING IT UP (2026-08-04).
  //
  // The branch below keyed on isBeneficiary, which requires an
  // archive_grants row. Since 0111, inherit-code redemption COPIES the
  // oracle into the recipient's account instead of granting access — so
  // every paid redemption took the owner branch and got:
  //
  //   "You're sending the FIRST text ... they just finished setting up
  //    the archive and opened the chat for the first time."
  //
  // That is the first message a grieving family ever receives from the
  // person they lost, and it greets them as though they had just
  // finished a form. Meanwhile beneficiaryMemorialPrompt — the one this
  // file's own comment calls the most emotionally loaded moment in the
  // whole product — was unreachable for every redemption.
  //
  // A redeemed copy is treated as a memorial welcome. We deliberately
  // do NOT require proof the creator has died: a code is redeemed after
  // a death in every real case, and if we're wrong the memorial prompt
  // is still warm and still honest, whereas the owner prompt is
  // actively false.
  let systemPrompt = isBeneficiary
    ? ownerDeceased
      ? beneficiaryMemorialPrompt
      : beneficiaryLivingPrompt
    : isInheritedCopy
      ? beneficiaryMemorialPrompt
      : ownerSystemPrompt;

  // Per-persona opener uniqueness. Rotates the "opener move" this
  // persona uses today (arrival / observation / question / dry /
  // tender / callback / present-moment / self-conscious) and
  // explicitly bans the phrases we've seen repeat across personas
  // ("you did it", "you're here", etc). Wilson: "I want it to feel
  // different with every person you speak to." Skip on the memorial
  // path — that moment doesn't need rotation, it needs stillness.
  if (oracleId && !(isBeneficiary && ownerDeceased)) {
    systemPrompt = `${systemPrompt}\n${openerVarietyBlock(oracleId)}`;
  }

  // Fable humanization Phase 2 — mood-of-the-day colors even the
  // first-impression opener, so the same identity has weather on
  // day-one too. SKIP on the memorial branch — the dead don't have
  // moods, and "MOOD TODAY" language on a "you're seeing me for
  // the first time since I died" moment would be gross.
  if (oracleId && !(isBeneficiary && ownerDeceased)) {
    const welcomeAvoid = memoryStyle === "sharp" ? (["distracted"] as const) : [];
    const welcomeMood = moodOfTheDay(oracleId, new Date().toISOString(), {
      avoid: welcomeAvoid,
    });
    const welcomeMoodBlock = moodToPromptBlock(welcomeMood);
    if (welcomeMoodBlock) {
      systemPrompt = `${systemPrompt}\n\n${welcomeMoodBlock}`;
    }

    // Formula v5 — ongoing arc on the welcome message too. The
    // persona references their in-motion life if it fits ("about
    // to head to PT," "sister's wedding this weekend"). Traits
    // + created_at loaded lazily below because the welcome route
    // resolves the oracle inside multiple branches; a small extra
    // read is cheap on a rare route. Skip on the memorial branch —
    // the dead don't have arcs and it would be gross.
    const { data: arcRow } = await admin
      .from("oracles")
      .select("traits, created_at")
      .eq("id", oracleId)
      .maybeSingle<{
        traits: { ongoingArcTemplate?: string | null } | null;
        created_at: string;
      }>();
    const arcTemplate = arcRow?.traits?.ongoingArcTemplate;
    if (arcTemplate && arcRow?.created_at) {
      const arc = currentArc(
        arcTemplate as Parameters<typeof currentArc>[0],
        oracleId,
        arcRow.created_at,
      );
      const arcBlock = arcToPromptBlock(arc);
      if (arcBlock) {
        systemPrompt = `${systemPrompt}\n\n${arcBlock}`;
      }
    }
  }

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 120,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "(system) Write the first message now. Just the text. No quotes around it, no preamble.",
        },
      ],
    });

    const reply = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!reply) {
      return NextResponse.json({ skipped: "empty_reply" });
    }

    await admin.from("messages").insert({
      user_id: user.id,
      oracle_id: oracleId,
      role: "assistant",
      content: reply,
      initiated_by_oracle: true,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("welcome message generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
