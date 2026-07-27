import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTermsAccepted } from "@/lib/legal/gate";

/**
 * Create a Stripe Billing Portal session for the current user and
 * return its URL. This is where "Manage subscription" in /settings
 * sends people — cancel, update card, view invoices, all handled
 * by Stripe's hosted portal.
 *
 * Requires:
 *   - The user has a stripe_customer_id (set by the initial
 *     pro_monthly checkout in the webhook). Users who've never
 *     subscribed get a clean 404 the settings page can render as
 *     "no subscription to manage".
 *
 * App Store 3.1.2 + Play 4.1: the portal is the surface where a
 * user cancels. Settings links here so the cancel path is one tap
 * from the app.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_subscription" },
      { status: 404 },
    );
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  // return_url — where Stripe sends the user when they close the portal.
  // Pull it off the request body if provided; default to /settings.
  let returnUrl = `${origin}/settings`;
  try {
    const body = await request.clone().json();
    if (typeof body?.return_url === "string" && body.return_url.startsWith("/")) {
      returnUrl = `${origin}${body.return_url}`;
    }
  } catch {
    // body optional
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
