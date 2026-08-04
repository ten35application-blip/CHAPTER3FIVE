import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";

export const runtime = "nodejs";

/**
 * "Is this deployment actually wired up."
 *
 * There is no boot-time config validation anywhere in this app. A
 * missing environment variable is not discovered by a deploy failing or
 * a check going red — it is discovered by a user walking into the one
 * code path that needs it and getting an error. The inherit route is
 * explicit about this:
 *
 *   if (!priceId) return "The payment step isn't set up yet."
 *
 * That message is shown to someone who just typed in the code their
 * family gave them to open their mother's archive. They would be the
 * monitoring.
 *
 * So: one endpoint that answers the question before a person has to.
 * Hit it after every deploy and before submitting to either store.
 *
 * NEVER RETURNS A VALUE — only whether the name is set, and for the
 * couple of cases where the shape matters, whether it looks right. An
 * admin-gated endpoint is still an endpoint, and an admin session is
 * still a stealable thing; there is no reason for a secret to be able
 * to leave the server through it.
 */

type Check = {
  name: string;
  present: boolean;
  /** Set when the value is present but looks wrong. */
  warning?: string;
};

/** Required for the app to function at all. Missing = the site is broken. */
const CORE = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_APP_URL",
];

/**
 * Required for money to work. Missing = a customer hits a dead end at
 * the moment they are trying to pay, which is also the moment they are
 * least willing to try again.
 */
const BILLING = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_INHERITED_SLOT",
  "STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE",
  "STRIPE_PRICE_ID_PRO_MONTHLY",
  "STRIPE_PRICE_ID_BASIC_MONTHLY",
  "STRIPE_PRICE_ID_EXTRA_ORACLE",
  "STRIPE_PRICE_ID_PACK_SMALL",
  "STRIPE_PRICE_ID_PACK_MEDIUM",
  "STRIPE_PRICE_ID_PACK_LARGE",
];

/**
 * Required for the safety promises the app makes in writing.
 * OPENAI_API_KEY is the moderation and abuse screen — without it the
 * Settings page's "every photo is scanned" is not true.
 */
const SAFETY = ["OPENAI_API_KEY", "CARE_TEAM_EMAIL"];

/** Background jobs and delivery. Missing = quiet degradation. */
const OPERATIONS = [
  "CRON_SECRET",
  "RESEND_API_KEY",
  "REPLICATE_API_TOKEN",
  "REVENUECAT_WEBHOOK_SECRET",
];

/** Web push. Missing = browser notifications silently never send. */
const PUSH = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_CONTACT",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
];

function check(name: string): Check {
  const raw = process.env[name];
  const present = typeof raw === "string" && raw.trim().length > 0;
  if (!present) return { name, present: false };

  const value = raw.trim();
  let warning: string | undefined;

  // Shape checks only — never the value itself.
  if (name.startsWith("STRIPE_PRICE_ID_") && !value.startsWith("price_")) {
    warning =
      "does not start with 'price_' — a Product id (prod_…) here creates a checkout that fails at Stripe";
  }
  if (name === "STRIPE_SECRET_KEY") {
    if (!value.startsWith("sk_") && !value.startsWith("rk_")) {
      warning = "does not look like a Stripe secret key";
    } else if (value.startsWith("sk_test_")) {
      warning = "TEST key — real cards will not work";
    }
  }
  if (name === "STRIPE_WEBHOOK_SECRET" && !value.startsWith("whsec_")) {
    warning = "does not start with 'whsec_'";
  }
  if (name === "NEXT_PUBLIC_APP_URL") {
    if (!/^https?:\/\//.test(value)) {
      warning = "is not an absolute URL — Stripe return URLs will be broken";
    } else if (value.includes("localhost")) {
      warning = "points at localhost — checkout will not return correctly";
    } else if (value.endsWith("/")) {
      warning = "has a trailing slash, which double-slashes built URLs";
    }
  }

  return { name, present: true, ...(warning ? { warning } : {}) };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  const groups = {
    core: CORE.map(check),
    billing: BILLING.map(check),
    safety: SAFETY.map(check),
    operations: OPERATIONS.map(check),
    push: PUSH.map(check),
  };

  const all = Object.values(groups).flat();
  const missing = all.filter((c) => !c.present).map((c) => c.name);
  const warnings = all
    .filter((c) => c.warning)
    .map((c) => `${c.name}: ${c.warning}`);

  return NextResponse.json(
    {
      // The headline. true means nothing is missing and nothing looks wrong.
      ok: missing.length === 0 && warnings.length === 0,
      environment: process.env.VERCEL_ENV ?? "unknown",
      missing,
      warnings,
      groups,
    },
    // 503 on a missing value so an uptime pinger can watch this without
    // parsing the body. Warnings alone stay 200 — they need a human,
    // not an alarm.
    { status: missing.length > 0 ? 503 : 200 },
  );
}
