import "server-only";
import { getStripe } from "@/lib/stripe";

/**
 * Find the live price for a one-time purchase.
 *
 * 2026-09-09: both $4.99 one-time prices on the website were archived in
 * Stripe while Vercel still pointed at them, and every "Record someone
 * you love" finish and every inherit-code redemption on the website
 * bounced with "Couldn't open the payment page". The phone never saw it
 * (Apple/Google). Now the price is resolved at checkout time:
 *
 *   1. the configured price id, if it is still active;
 *   2. otherwise the PRODUCT's active one-time price — after checking
 *      the product's name is the one we expect, so a wrong id can never
 *      quietly charge for something else.
 *
 * Cached for ten minutes so checkout stays one round-trip.
 */

type Kind = "other_identity_create" | "inherited_slot";

const CONFIG: Record<Kind, { price: string | undefined; product: string | undefined; name: RegExp; search: string; amount: number }> = {
  other_identity_create: {
    price: process.env.STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE,
    product: process.env.STRIPE_PRODUCT_ID_OTHER_IDENTITY_CREATE,
    name: /someone you love/i,
    search: "Someone You Love",
    amount: 499,
  },
  inherited_slot: {
    price: process.env.STRIPE_PRICE_ID_INHERITED_SLOT,
    product: process.env.STRIPE_PRODUCT_ID_INHERITED_SLOT,
    name: /inherit code/i,
    search: "Inherit Code",
    amount: 499,
  },
};

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<Kind, { id: string; at: number }>();

export async function resolveOneTimePriceId(kind: Kind): Promise<string | null> {
  const hit = cache.get(kind);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;
  const cfg = CONFIG[kind];
  const stripe = getStripe();

  if (cfg.price) {
    try {
      const p = await stripe.prices.retrieve(cfg.price);
      if (p.active) {
        cache.set(kind, { id: p.id, at: Date.now() });
        return p.id;
      }
      console.error(`[stripe] ${kind}: configured price is inactive, falling back to the product's live price`);
    } catch (err) {
      console.error(`[stripe] ${kind}: configured price could not be read:`, err);
    }
  }

  // Which product? The configured id if its name checks out; otherwise
  // search the catalog by name — so nobody has to know which id is which.
  let productId: string | null = null;
  if (cfg.product) {
    try {
      const product = await stripe.products.retrieve(cfg.product);
      if (cfg.name.test(product.name) && product.active) productId = product.id;
      else console.error(`[stripe] ${kind}: configured product "${product.name}" is not the expected one — searching by name instead`);
    } catch (err) {
      console.error(`[stripe] ${kind}: configured product could not be read:`, err);
    }
  }
  if (!productId) {
    try {
      const found = await stripe.products.search({ query: `active:'true' AND name~'${cfg.search}'`, limit: 5 });
      const match = found.data.find((p) => cfg.name.test(p.name));
      if (match) productId = match.id;
      else console.error(`[stripe] ${kind}: no active product named like "${cfg.search}"`);
    } catch (err) {
      console.error(`[stripe] ${kind}: product search failed:`, err);
    }
  }
  if (!productId) return null;

  try {
    const list = await stripe.prices.list({ product: productId, active: true, type: "one_time", limit: 10 });
    const exact = list.data.find((p) => p.unit_amount === cfg.amount && p.currency === "usd");
    const chosen = exact ?? list.data[0];
    if (chosen) {
      cache.set(kind, { id: chosen.id, at: Date.now() });
      return chosen.id;
    }
    console.error(`[stripe] ${kind}: product ${productId} has no active one-time price`);
  } catch (err) {
    console.error(`[stripe] ${kind}: price lookup failed:`, err);
  }
  return null;
}

/** For pages that only need to know a checkout is possible at all. */
export function oneTimePriceConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
