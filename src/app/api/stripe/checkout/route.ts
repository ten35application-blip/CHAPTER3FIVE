import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe, RANDOMIZE_PRICE_USD_CENTS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create a Stripe Checkout session for a $5 randomize credit.
 * On success, the webhook will mark the payment as paid and grant +1
 * randomize credit to the user.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

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
          unit_amount: RANDOMIZE_PRICE_USD_CENTS,
          product_data: {
            name: "chapter3five — randomize",
            description: "One additional randomized character generation.",
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      purpose: "randomize",
    },
    success_url: `${origin}/randomize/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/randomize/cancel`,
  });

  // Record a pending payment row so we can reconcile.
  const admin = createAdminClient();
  await admin.from("payments").insert({
    user_id: user.id,
    stripe_session_id: session.id,
    amount_cents: RANDOMIZE_PRICE_USD_CENTS,
    currency: "usd",
    purpose: "randomize",
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
