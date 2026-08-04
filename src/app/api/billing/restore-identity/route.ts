import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING } from "@/lib/pricing";
import { recordPendingPayment } from "@/lib/billing/pendingPayment";

export const runtime = "nodejs";

/**
 * POST /api/billing/restore-identity — one-time Stripe Checkout
 * session that, on webhook receipt (checkout.session.completed with
 * metadata.purpose='restore_oracle'), clears oracles.deleted_at for
 * the given oracle_id. Idempotency and the credit-grant path live in
 * /api/stripe/webhook — this endpoint only mints the session.
 *
 * If STRIPE_SECRET_KEY is not yet configured, we return 501 with a
 * friendly message. Console-logs the intent so the operator can see
 * demand while the key is being provisioned.
 *
 * Ownership: the oracle must belong to the caller and must currently
 * be soft-deleted (deleted_at IS NOT NULL). Anything else 400s.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    oracle_id?: string;
  };
  const oracleId = typeof body.oracle_id === "string" ? body.oracle_id : null;
  if (!oracleId) {
    return NextResponse.json(
      { error: "oracle_id is required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Ownership + soft-deleted check via user's own token. RLS from 0002
  // already restricts oracles selects to the owner, but this second
  // filter guarantees we're not billing to restore something that's
  // already active.
  //
  // Deliberately NOT selecting restore_price_cents: the price is
  // derived from the PRICING constant below, not from the DB column,
  // because until migration 0117 landed the column was client-
  // writable (Fable audit C2). Even with 0117 blocking further
  // patches, we don't want to trust any past-manipulated value
  // sitting on an oracle row. This closes the "restore a $5 identity
  // for $0.50 by first PATCHing your own row" attack.
  // OWNERSHIP IS EXPLICIT (2026-08-04). This used to filter on id +
  // deleted_at only, relying on "RLS restricts oracles selects to the
  // owner". That is not the full policy set: 0040 adds
  // "oracles: invitees read via grant" using user_has_grant_on_oracle(id),
  // with no deleted_at predicate, and beneficiary/claim writes real
  // archive_grants rows. So a BENEFICIARY could POST a soft-deleted
  // oracle they merely hold a grant on and be charged $5 — while the
  // webhook's restore is user_id-scoped and would match zero rows.
  // Money in, nothing delivered, and the profile write that follows it
  // is not gated on the restore succeeding, so the payer's
  // active_oracle_id got clobbered to a foreign oracle on top.
  //
  // The free-legacy branch further down already scoped by user_id; the
  // paid branch is the one that didn't.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, deleted_at, is_legacy")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!oracle) {
    return NextResponse.json(
      { error: "That identity is not in the trash." },
      { status: 400 },
    );
  }

  // Legacy identities are always free to restore. Someone deleting
  // a mother's archive during acute grief and being asked to pay to
  // get it back is a line we don't cross. Terms §8 documents this.
  // Restore via admin client (0067 blocks user-role writes) and
  // return a done payload — the client shows a "back" toast.
  if (oracle.is_legacy) {
    const admin = createAdminClient();
    await admin
      .from("oracles")
      .update({ deleted_at: null, scheduled_purge_at: null })
      .eq("id", oracleId)
      .eq("user_id", user.id);
    return NextResponse.json({
      restored: true,
      free: true,
      reason: "legacy_identities_are_never_paywalled",
    });
  }

  const priceCents = PRICING.restoreIdentityCents;

  // Stub mode: no Stripe key yet. Report cleanly so the client can show
  // a "coming soon" message; log the intent so demand is visible.
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn(
      `[billing/restore-identity] STUB — user ${user.id} tried to restore oracle ${oracleId} (${oracle.name})`,
    );
    return NextResponse.json(
      {
        stubbed: true,
        message:
          "Restore payments are being set up. Check back soon — we've logged your request.",
      },
      { status: 501 },
    );
  }

  const { getStripe } = await import("@/lib/stripe");

  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: "chapter3five — restore identity",
            description: `Bring ${oracle.name} back with the conversation preserved.`,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      // Existing webhook (see /api/stripe/webhook/route.ts) recognizes
      // this purpose and clears deleted_at.
      purpose: "restore_oracle",
      oracle_id: oracleId,
    },
    success_url: `${origin}/dashboard?restored=1`,
    cancel_url: `${origin}/dashboard?restore_cancelled=1`,
  });

  const admin = createAdminClient();
  const record = await recordPendingPayment({
    admin,
    stripe,
    session,
    row: {
      user_id: user.id,
      amount_cents: priceCents,
      currency: "usd",
      purpose: "restore_oracle",
    },
  });
  if (!record.ok) return record.response;

  return NextResponse.json({ url: session.url });
}
