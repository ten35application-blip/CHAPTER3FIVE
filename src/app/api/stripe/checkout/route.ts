import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe, RANDOMIZE_PRICE_USD_CENTS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Create a Stripe Checkout session for a $5 credit. The `purpose` query/body
 * field decides what the credit unlocks:
 *   - "randomize" (default) — adds 1 to randomize_credits
 *   - "oracle"             — adds 1 to extra_oracle_credits
 */
export async function POST(request: NextRequest) {
  let purpose: "randomize" | "oracle" = "randomize";
  try {
    const body = await request.clone().json();
    if (body?.purpose === "oracle" || body?.purpose === "randomize") {
      purpose = body.purpose;
    }
  } catch {
    // body optional
  }
  const url = new URL(request.url);
  const qp = url.searchParams.get("purpose");
  if (qp === "oracle" || qp === "randomize") {
    purpose = qp;
  }

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

  const productName =
    purpose === "oracle"
      ? "chapter3five — new thirtyfive"
      : "chapter3five — randomize";
  const productDesc =
    purpose === "oracle"
      ? "Create one additional thirtyfive in your account."
      : "One additional randomized character generation.";
  const successPath =
    purpose === "oracle"
      ? "/oracle/success?session_id={CHECKOUT_SESSION_ID}"
      : "/randomize/success?session_id={CHECKOUT_SESSION_ID}";
  const cancelPath = purpose === "oracle" ? "/oracle/cancel" : "/randomize/cancel";

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
            name: productName,
            description: productDesc,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      purpose,
    },
    success_url: `${origin}${successPath}`,
    cancel_url: `${origin}${cancelPath}`,
  });

  // Record a pending payment row so we can reconcile.
  const admin = createAdminClient();
  await admin.from("payments").insert({
    user_id: user.id,
    stripe_session_id: session.id,
    amount_cents: RANDOMIZE_PRICE_USD_CENTS,
    currency: "usd",
    purpose,
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
