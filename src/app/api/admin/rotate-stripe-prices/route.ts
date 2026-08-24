import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getStripe } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";

/**
 * TEMPORARY, single-purpose, and dead by default.
 *
 * Stripe Prices are immutable, so store parity means minting NEW .99
 * Prices on the same Products, pointing default_price at them, and
 * archiving the old ones. The secret key is a Vercel sensitive env
 * that cannot leave Vercel, so the minting happens here, where the key
 * already lives.
 *
 * Gated on PRICE_ROTATE_SECRET, which Wilson set by hand for this one
 * rotation: no env, no route (404, indistinguishable from any unknown
 * path). The file is deleted the moment the rotation is verified.
 */
export const runtime = "nodejs";

const TARGETS = [
  {
    env: "STRIPE_PRICE_ID_BASIC_MONTHLY",
    cents: PRICING.basicMonthlyCents,
    key: "c3f_basic_monthly",
  },
  {
    env: "STRIPE_PRICE_ID_PRO_MONTHLY",
    cents: PRICING.monthlyCents,
    key: "c3f_pro_monthly",
  },
  {
    env: "STRIPE_PRICE_ID_PACK_SMALL",
    cents: PRICING.packSmallCents,
    key: "c3f_pack_small",
  },
  {
    env: "STRIPE_PRICE_ID_PACK_MEDIUM",
    cents: PRICING.packMediumCents,
    key: "c3f_pack_medium",
  },
  {
    env: "STRIPE_PRICE_ID_PACK_LARGE",
    cents: PRICING.packLargeCents,
    key: "c3f_pack_large",
  },
  {
    env: "STRIPE_PRICE_ID_EXTRA_ORACLE",
    cents: PRICING.extraIdentityCents,
    key: "c3f_extra_oracle",
  },
  {
    env: "STRIPE_PRICE_ID_INHERITED_SLOT",
    cents: PRICING.inheritedSlotPurchaseCents,
    key: "c3f_inherited_slot",
  },
  {
    env: "STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE",
    cents: PRICING.otherIdentityCreateCents,
    key: "c3f_other_identity_create",
  },
] as const;

export async function POST(req: NextRequest) {
  const secret = process.env.PRICE_ROTATE_SECRET;
  if (!secret) return new NextResponse(null, { status: 404 });

  const presented = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse(null, { status: 404 });
  }

  const { dryRun } = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
  };
  const stripe = getStripe();
  const report: Record<string, unknown>[] = [];

  for (const t of TARGETS) {
    const priceId = process.env[t.env];
    if (!priceId) {
      report.push({ env: t.env, status: "env_missing" });
      continue;
    }
    try {
      // A lookup-key hit means this SKU is already rotated — repeat
      // runs must report success, not mint duplicates.
      const existing = await stripe.prices.list({
        lookup_keys: [t.key],
        active: true,
        limit: 1,
      });
      const already = existing.data[0];
      if (already && already.unit_amount === t.cents) {
        report.push({
          env: t.env,
          status: "already_rotated",
          priceId: already.id,
          cents: already.unit_amount,
        });
        continue;
      }

      const old = await stripe.prices.retrieve(priceId);
      if (dryRun) {
        report.push({
          env: t.env,
          status: "would_rotate",
          oldPriceId: priceId,
          oldCents: old.unit_amount,
          newCents: t.cents,
          lookupKey: t.key,
          product: old.product,
          recurring: old.recurring?.interval ?? null,
        });
        continue;
      }

      const created = await stripe.prices.create({
        product: old.product as string,
        currency: old.currency,
        unit_amount: t.cents,
        lookup_key: t.key,
        nickname: `store parity $${(t.cents / 100).toFixed(2)} (2026-08-24)`,
        ...(old.recurring
          ? { recurring: { interval: old.recurring.interval } }
          : {}),
        tax_behavior:
          old.tax_behavior && old.tax_behavior !== "unspecified"
            ? old.tax_behavior
            : "exclusive",
      });
      await stripe.products.update(old.product as string, {
        default_price: created.id,
      });
      await stripe.prices.update(priceId, { active: false });
      report.push({
        env: t.env,
        status: "rotated",
        oldPriceId: priceId,
        oldCents: old.unit_amount,
        newPriceId: created.id,
        newCents: created.unit_amount,
        lookupKey: t.key,
      });
    } catch (err) {
      report.push({
        env: t.env,
        status: "error",
        priceId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ dryRun: dryRun ?? false, report });
}
