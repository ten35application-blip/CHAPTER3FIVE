/**
 * Concierge cap-hit outreach + conversational top-off.
 *
 * When a user trips a monthly ceiling (message cap, image cap, or the
 * free-tier spend governor) the 402 sites call sendConciergeCapNotice:
 * Adrian drops a message into the user's concierge thread offering a
 * top-off, and a web push fires so the phone buzzes like a real text.
 * Dedupe (once per cap-kind per calendar month) is enforced entirely
 * server-side by the unique index on concierge_cap_notices (0114) —
 * nothing here trusts client hints.
 *
 * The other half lives in the chat stream route: when the user replies
 * to Adrian with a pack intent ("small", "$10", "20 images"), the
 * route calls detectPackIntent + getRecentCapNotice and — only when a
 * REAL server-recorded cap notice exists within 24h — answers
 * programmatically with a Stripe Checkout link via
 * respondWithTopoffLink. No Claude call is made on that turn.
 *
 * Security invariants (adversarially checked before shipping):
 *   - concierge_cap_notices is service-role-only (RLS enabled, no
 *     policies, zero grants to anon/authenticated) → users cannot
 *     forge a notice to unlock the intercept.
 *   - Checkout sessions are capped per notice (MAX_CHECKOUTS_PER_NOTICE)
 *     and the intercept path still pays the daily rate-limit bump in
 *     the route, so it cannot be used as a free unmetered echo chamber.
 *   - Every session carries metadata.user_id + customer_email, so a
 *     leaked URL still only credits the buyer's own account (the
 *     webhook credits by metadata.user_id).
 *   - Push is best-effort: no subscription → silent no-op (webPush.ts
 *     already behaves that way); a push failure never surfaces.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPendingPaymentOrThrow } from "@/lib/billing/pendingPayment";
import { getConciergeId } from "@/lib/identity/concierge";
import { sendWebPushToUser } from "@/lib/webPush";
import { getStripe } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import type { PlanTier } from "@/lib/subscription";

export type CapKind = "messages" | "images" | "spend";

/** How many checkout sessions the chat intercept will mint against a
 *  single cap notice before it starts pointing at Settings instead.
 *  Server-enforced via concierge_cap_notices.checkout_count. */
const MAX_CHECKOUTS_PER_NOTICE = 5;

/** 'YYYY-MM' in UTC — the dedupe window key. */
export function currentCapMonth(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Origin for building absolute URLs (checkout success/cancel, the
 *  upgrade link in spend-cap copy). Vercel terminates TLS upstream, so
 *  prefer forwarded proto + host; fall back to the request URL. */
export function requestOrigin(request: {
  headers: Headers;
  url: string;
}): string {
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

/* ------------------------------------------------------------------ */
/* Piece 1 + 2 — Adrian's cap-hit message + push                       */
/* ------------------------------------------------------------------ */

type Lang = "en" | "es";

function tierLabel(tier: PlanTier, lang: Lang): string {
  if (tier === "basic") return "Basic";
  if (tier === "pro") return "Pro";
  return lang === "es" ? "el plan Gratis" : "the Free plan";
}

function packMenuLine(kind: "messages" | "images", lang: Lang): string {
  const p = PRICING;
  if (kind === "messages") {
    return lang === "es"
      ? `Responde small ($5 por +${p.packSmallMessages} mensajes), medium ($10 por +${p.packMediumMessages}) o large ($20 por +${p.packLargeMessages}) y te mando un enlace de pago. Agrega la palabra "images" si prefieres recargar fotos.`
      : `Reply small ($5 for +${p.packSmallMessages} messages), medium ($10 for +${p.packMediumMessages}), or large ($20 for +${p.packLargeMessages}) and I'll get you a checkout link. Add the word "images" if you'd rather top off photos.`;
  }
  return lang === "es"
    ? `Responde small images ($5 por +${p.packSmallImages}), medium images ($10 por +${p.packMediumImages}) o large images ($20 por +${p.packLargeImages}) y te mando un enlace de pago. Solo small/medium/large te da un paquete de mensajes.`
    : `Reply small images ($5 for +${p.packSmallImages}), medium images ($10 for +${p.packMediumImages}), or large images ($20 for +${p.packLargeImages}) and I'll get you a checkout link. Plain small/medium/large gets you a message pack instead.`;
}

function buildCapNoticeBody(opts: {
  capKind: CapKind;
  tier: PlanTier;
  limit: number;
  origin: string;
  lang: Lang;
}): string {
  const { capKind, tier, limit, origin, lang } = opts;
  const plan = tierLabel(tier, lang);
  const settings =
    lang === "es"
      ? "Los paquetes también están en Configuración, en Uso extra, cuando quieras."
      : "Packs are also in Settings under Extra usage, any time.";

  if (capKind === "spend") {
    return lang === "es"
      ? `Ya usaste el tiempo de conversación incluido este mes en ${plan}. Subir de plan lo amplía — Basic cuesta $5/mes y Pro $10/mes: ${origin}/upgrade. Si no, todo se reinicia al empezar el próximo mes.`
      : `You've used this month's included conversation time on ${plan}. Upgrading lifts it — Basic is $5/mo, Pro is $10/mo: ${origin}/upgrade. Otherwise everything resets at the start of next month.`;
  }

  if (capKind === "images") {
    const opener =
      lang === "es"
        ? `Ya usaste los ${limit} envíos de fotos de este mes en ${plan}. ¿Quieres recargar?`
        : `You've used this month's ${limit} photo sends on ${plan}. Want to top off?`;
    return `${opener} ${packMenuLine("images", lang)} ${settings}`;
  }

  const opener =
    lang === "es"
      ? `Llegaste al límite de ${limit} mensajes de este mes en ${plan}. ¿Quieres recargar?`
      : `You've hit this month's ${limit}-message cap on ${plan}. Want to top off?`;
  return `${opener} ${packMenuLine("messages", lang)} ${settings}`;
}

function buildPushBody(capKind: CapKind, lang: Lang): string {
  if (capKind === "spend") {
    return lang === "es"
      ? "Llegaste al límite de uso de este mes — te dejé una nota."
      : "You've hit this month's usage limit — I left you a note.";
  }
  if (capKind === "images") {
    return lang === "es"
      ? "Llegaste al límite de fotos de este mes — ¿quieres recargar?"
      : "You've hit this month's photo cap — want to top off?";
  }
  return lang === "es"
    ? "Llegaste al límite de mensajes de este mes — ¿quieres recargar?"
    : "You've hit this month's message cap — want to top off?";
}

/**
 * Insert Adrian's cap-hit message + fire the push, at most once per
 * cap-kind per calendar month per user. Never throws — the 402 this
 * rides on must ship regardless. Designed to run inside after().
 */
export async function sendConciergeCapNotice(opts: {
  userId: string;
  capKind: CapKind;
  /** Tier at the moment of the hit — copy only. */
  tier: PlanTier;
  /** The cap value: message/image count, or cents for "spend". */
  limit: number;
  origin: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // Dedupe FIRST, race-safe: the unique index makes the second
    // concurrent insert fail with 23505 and that caller stands down.
    const { data: notice, error: noticeErr } = await admin
      .from("concierge_cap_notices")
      .insert({
        user_id: opts.userId,
        cap_kind: opts.capKind,
        month: currentCapMonth(),
      })
      .select("id")
      .single<{ id: string }>();
    if (noticeErr || !notice) {
      if (noticeErr && noticeErr.code !== "23505") {
        console.error("[capNotice] notice insert failed:", noticeErr);
      }
      return; // already notified this month (or ledger broken — stand down)
    }

    const conciergeId = await getConciergeId();
    if (!conciergeId) return;

    const { data: profile } = await admin
      .from("profiles")
      .select("preferred_language")
      .eq("id", opts.userId)
      .maybeSingle<{ preferred_language: string | null }>();
    const lang: Lang = profile?.preferred_language === "es" ? "es" : "en";

    const body = buildCapNoticeBody({
      capKind: opts.capKind,
      tier: opts.tier,
      limit: opts.limit,
      origin: opts.origin,
      lang,
    });

    const { data: msgRow, error: msgErr } = await admin
      .from("messages")
      .insert({
        user_id: opts.userId,
        oracle_id: conciergeId,
        role: "assistant",
        content: body,
        initiated_by_oracle: true,
        initiated_by: "concierge",
      })
      .select("id")
      .single<{ id: string }>();
    if (msgErr || !msgRow) {
      console.error("[capNotice] message insert failed:", msgErr);
      return;
    }

    await admin
      .from("concierge_cap_notices")
      .update({ message_id: msgRow.id })
      .eq("id", notice.id);

    // Push — best-effort, silent no-op when the user never opted in
    // (sendWebPushToUser returns {sent:false, reason:"no_subscription"}).
    await sendWebPushToUser({
      userId: opts.userId,
      payload: {
        title: "Adrian",
        body: buildPushBody(opts.capKind, lang),
        url: `/chat/${conciergeId}`,
        tag: `concierge-cap-${opts.capKind}`,
      },
    }).catch((err) => console.error("[capNotice] push failed:", err));
  } catch (err) {
    console.error("[capNotice] unexpected failure:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Piece 3 — billing-intent detection + programmatic top-off reply     */
/* ------------------------------------------------------------------ */

export type PackId = "small" | "medium" | "large";
export type PackIntent = { pack: PackId; packType: "message" | "image" };

const PACK_TOKENS: Record<PackId, ReadonlySet<string>> = {
  small: new Set(["small", "pequeño", "pequeno", "chico", "$5", "5", "5$"]),
  medium: new Set(["medium", "mediano", "$10", "10", "10$"]),
  large: new Set(["large", "grande", "$20", "20", "20$"]),
};

const IMAGE_TOKENS = new Set([
  "image",
  "images",
  "photo",
  "photos",
  "foto",
  "fotos",
  "imagen",
  "imagenes",
  "imágenes",
]);

/**
 * Deliberately dumb intent detector — no LLM. A message qualifies when
 * it is short and dominated by exactly one pack token ("small", "$10",
 * "20 images", "the medium one"). Bare digits get a tighter word
 * budget so "i walked 10 miles today with the dogs" never trips it.
 * Anything ambiguous (two different pack tokens) returns null and the
 * turn falls through to the normal pipeline.
 */
export function detectPackIntent(message: string): PackIntent | null {
  const tokens = message
    .toLowerCase()
    .replace(/[.,!?¡¿;:()"']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0 || tokens.length > 8) return null;

  const matched = new Set<PackId>();
  let matchedViaBareDigit = false;
  for (const token of tokens) {
    for (const pack of ["small", "medium", "large"] as const) {
      if (PACK_TOKENS[pack].has(token)) {
        matched.add(pack);
        if (/^\d+$/.test(token)) matchedViaBareDigit = true;
      }
    }
  }
  if (matched.size !== 1) return null;
  // A bare number ("5", "10", "20") only counts in a very short
  // message — "$5"/"small" keep the full 8-word budget.
  if (matchedViaBareDigit && tokens.length > 4) return null;

  const pack = [...matched][0];
  const wantsImages = tokens.some((t) => IMAGE_TOKENS.has(t));
  return { pack, packType: wantsImages ? "image" : "message" };
}

export type RecentCapNotice = {
  id: string;
  capKind: CapKind;
  checkoutCount: number;
};

/**
 * The intercept's authorization: a service-role-recorded cap notice
 * for THIS user within the last 24h. Spend-cap notices don't qualify —
 * packs top up messages/images, not the Anthropic-spend governor.
 * Returns null on any failure (fail-closed → normal chat pipeline).
 */
export async function getRecentCapNotice(
  userId: string,
): Promise<RecentCapNotice | null> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from("concierge_cap_notices")
      .select("id, cap_kind, checkout_count")
      .eq("user_id", userId)
      .in("cap_kind", ["messages", "images"])
      .gte("notified_at", cutoff)
      .order("notified_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; cap_kind: CapKind; checkout_count: number }>();
    if (!data) return null;
    return {
      id: data.id,
      capKind: data.cap_kind,
      checkoutCount: data.checkout_count ?? 0,
    };
  } catch {
    return null;
  }
}

const PACK_META: Record<
  PackId,
  {
    purpose: "pack_small" | "pack_medium" | "pack_large";
    cents: number;
    messages: number;
    images: number;
    label: string;
  }
> = {
  small: {
    purpose: "pack_small",
    cents: PRICING.packSmallCents,
    messages: PRICING.packSmallMessages,
    images: PRICING.packSmallImages,
    label: "Small",
  },
  medium: {
    purpose: "pack_medium",
    cents: PRICING.packMediumCents,
    messages: PRICING.packMediumMessages,
    images: PRICING.packMediumImages,
    label: "Medium",
  },
  large: {
    purpose: "pack_large",
    cents: PRICING.packLargeCents,
    messages: PRICING.packLargeMessages,
    images: PRICING.packLargeImages,
    label: "Large",
  },
};

function packPriceEnv(pack: PackId): string | undefined {
  // Direct references (not process.env[dynamic]) so Next's env
  // inlining keeps working.
  if (pack === "small") return process.env.STRIPE_PRICE_ID_PACK_SMALL;
  if (pack === "medium") return process.env.STRIPE_PRICE_ID_PACK_MEDIUM;
  return process.env.STRIPE_PRICE_ID_PACK_LARGE;
}

function buildTopoffReply(opts: {
  intent: PackIntent;
  url: string;
  lang: Lang;
}): string {
  const { intent, url, lang } = opts;
  const meta = PACK_META[intent.pack];
  const price = `$${meta.cents / 100}`;
  const size = intent.pack;
  if (intent.packType === "image") {
    const line = `${meta.label} pack — +${meta.images} ${lang === "es" ? "fotos" : "images"} — ${price}:`;
    const note =
      lang === "es"
        ? `Ese es un paquete de fotos — si querías mensajes, responde solo "${size}".`
        : `That's a photo pack — if you meant messages, just reply "${size}".`;
    return `${lang === "es" ? "Espera — te consigo ese enlace." : "Hold on — getting that link for you."}\n\n${line}\n${url}\n\n${note}`;
  }
  const line = `${meta.label} pack — +${meta.messages} ${lang === "es" ? "mensajes" : "messages"} — ${price}:`;
  const note =
    lang === "es"
      ? `Ese es un paquete de mensajes — si querías fotos, responde "${size} images".`
      : `That's a message pack — if you meant photos, reply "${size} images" instead.`;
  return `${lang === "es" ? "Espera — te consigo ese enlace." : "Hold on — getting that link for you."}\n\n${line}\n${url}\n\n${note}`;
}

/** SSE response that mimics the stream route's frame sequence so the
 *  existing ChatSurface reader renders it with zero client changes. */
function sseResponse(frames: Record<string, unknown>[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Handle a matched top-off intent inside Adrian's chat: persist the
 * user's turn, mint a Stripe Checkout session scoped to this user,
 * reply with the link — all without touching Claude. Every outcome
 * (over the per-notice checkout limit, price env missing, Stripe
 * down) still answers in Adrian's voice so the conversation never
 * dead-ends.
 *
 * Caller has already: authenticated, passed the legal gate, verified
 * the oracle is the concierge, matched detectPackIntent, fetched a
 * real recent cap notice, and paid the daily rate-limit bump.
 */
export async function respondWithTopoffLink(opts: {
  /** The CALLER's client — the user turn insert must ride RLS. */
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | null;
  conciergeOracleId: string;
  userMessage: string;
  intent: PackIntent;
  notice: RecentCapNotice;
  origin: string;
}): Promise<Response> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("preferred_language")
    .eq("id", opts.userId)
    .maybeSingle<{ preferred_language: string | null }>();
  const lang: Lang = profile?.preferred_language === "es" ? "es" : "en";

  // 1) Persist the user's turn through RLS (0108's concierge branch
  //    authorizes it). A failed insert is a hard error — mirroring
  //    the stream route.
  const { data: userRow, error: insertErr } = await opts.supabase
    .from("messages")
    .insert({
      user_id: opts.userId,
      oracle_id: opts.conciergeOracleId,
      role: "user",
      content: opts.userMessage,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertErr || !userRow) {
    console.error("[capNotice] top-off user insert failed:", insertErr);
    return NextResponse.json(
      { error: "Could not save message" },
      { status: 500 },
    );
  }

  // 2) Read receipt, same as the stream route.
  const readByOracleAt = new Date().toISOString();
  await admin
    .from("messages")
    .update({ read_by_oracle_at: readByOracleAt })
    .eq("oracle_id", opts.conciergeOracleId)
    .eq("user_id", opts.userId)
    .eq("role", "user")
    .is("read_by_oracle_at", null)
    .is("deleted_at", null);

  // 3) Compose the reply — link when everything lines up, a graceful
  //    Settings pointer otherwise.
  let reply: string;
  if (opts.notice.checkoutCount >= MAX_CHECKOUTS_PER_NOTICE) {
    reply =
      lang === "es"
        ? "Ya te hice varios enlaces de pago — usa el más reciente, o consigue el paquete en Configuración, en Uso extra."
        : "I've already made you a few checkout links — use the most recent one, or grab the pack in Settings under Extra usage.";
  } else {
    const priceId = packPriceEnv(opts.intent.pack);
    if (!priceId) {
      reply =
        lang === "es"
          ? "No puedo armar ese enlace ahora mismo — puedes conseguir el paquete en Configuración, en Uso extra."
          : "I can't build that link right now — you can grab the pack in Settings under Extra usage.";
    } else {
      try {
        const meta = PACK_META[opts.intent.pack];
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          customer_email: opts.userEmail ?? undefined,
          line_items: [{ price: priceId, quantity: 1 }],
          // Scoped to THIS buyer: the webhook credits metadata.user_id,
          // so a leaked URL can only ever top up the buyer's account.
          metadata: {
            user_id: opts.userId,
            purpose: meta.purpose,
            pack_kind: opts.intent.pack,
            pack_type: opts.intent.packType,
            source: "concierge_chat",
          },
          success_url: `${opts.origin}/dashboard?pack=1`,
          cancel_url: `${opts.origin}/chat/${opts.conciergeOracleId}?cancelled=1`,
        });
        if (!session.url) throw new Error("session has no url");

        // Pending ledger row — same shape as /api/stripe/checkout so
        // /admin/revenue reconciliation sees one consistent stream.
        // H2 fix: throws on insert failure (surrounding try/catch
        // handles it); helper also expires the Stripe session so a
        // failed insert can't leave the concierge chat with a
        // pay-and-get-nothing URL.
        await recordPendingPaymentOrThrow({
          admin,
          stripe,
          session,
          row: {
            user_id: opts.userId,
            amount_cents: meta.cents,
            currency: "usd",
            purpose: meta.purpose,
          },
        });

        // Bump the per-notice checkout counter (read-modify-write;
        // a rare concurrent race undercounts by one, acceptable for a
        // soft rate limit backstopped by the daily message cap).
        await admin
          .from("concierge_cap_notices")
          .update({
            checkout_count: opts.notice.checkoutCount + 1,
            last_checkout_at: new Date().toISOString(),
          })
          .eq("id", opts.notice.id);

        reply = buildTopoffReply({
          intent: opts.intent,
          url: session.url,
          lang,
        });
      } catch (err) {
        console.error("[capNotice] stripe session failed:", err);
        reply =
          lang === "es"
            ? "Algo falló de mi lado al generar el enlace — intenta de nuevo en un minuto, o consigue el paquete en Configuración, en Uso extra."
            : "Something hiccuped on my end getting that link — try again in a minute, or grab the pack in Settings under Extra usage.";
      }
    }
  }

  // 4) Persist Adrian's reply (assistant rows are server-written only).
  let messageId: string | null = null;
  const { data: replyRow, error: replyErr } = await admin
    .from("messages")
    .insert({
      user_id: opts.userId,
      oracle_id: opts.conciergeOracleId,
      role: "assistant",
      content: reply,
      initiated_by: "concierge",
    })
    .select("id")
    .single<{ id: string }>();
  if (replyErr) {
    console.error("[capNotice] top-off reply insert failed:", replyErr);
  } else {
    messageId = replyRow?.id ?? null;
  }

  // 5) Stream it back in the exact frame shape ChatSurface expects.
  return sseResponse([
    { type: "begin", userMessageId: userRow.id, readByOracleAt },
    { type: "text", text: reply },
    { type: "done", messageId },
  ]);
}
