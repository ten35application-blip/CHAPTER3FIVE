import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING } from "@/lib/pricing";

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
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, deleted_at, restore_price_cents")
    .eq("id", oracleId)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!oracle) {
    return NextResponse.json(
      { error: "That identity is not in the trash." },
      { status: 400 },
    );
  }

  const priceCents =
    typeof oracle.restore_price_cents === "number"
      ? oracle.restore_price_cents
      : PRICING.restoreIdentityCents;

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
  await admin.from("payments").insert({
    user_id: user.id,
    stripe_session_id: session.id,
    amount_cents: priceCents,
    currency: "usd",
    purpose: "restore_oracle",
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
