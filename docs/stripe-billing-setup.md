# Stripe billing setup — Basic tier + add-on packs

The code for the three-tier + packs model is fully wired (checkout,
webhook, credit balances, UI). Each surface activates itself the
moment its Price ID env var exists — until then it shows the mailto
fallback. To turn everything on:

## 1. Create the Products/Prices in the Stripe Dashboard

Product catalog → Add product. Five Prices total (Pro may already
exist):

| Product name (suggested)     | Price   | Type                | Env var                        |
| ---------------------------- | ------- | ------------------- | ------------------------------ |
| chapter3five Pro             | $12.00  | Recurring, monthly  | `STRIPE_PRICE_ID_PRO_MONTHLY`  |
| chapter3five Basic           | $5.00   | Recurring, monthly  | `STRIPE_PRICE_ID_BASIC_MONTHLY`|
| chapter3five Small pack      | $5.00   | One-time            | `STRIPE_PRICE_ID_PACK_SMALL`   |
| chapter3five Medium pack     | $10.00  | One-time            | `STRIPE_PRICE_ID_PACK_MEDIUM`  |
| chapter3five Large pack      | $20.00  | One-time            | `STRIPE_PRICE_ID_PACK_LARGE`   |

Notes:

- One pack Product per size is enough — whether the buyer gets
  messages or images is decided in OUR UI and rides through checkout
  metadata (`pack_type`), not through separate Stripe Prices.
- Amounts must match `src/lib/pricing.ts` (`monthlyCents`,
  `basicMonthlyCents`, `packSmallCents`, `packMediumCents`,
  `packLargeCents`). If a price ever changes, change it in BOTH
  places.
- Currency: USD.

## 2. Add the Price IDs to Vercel env vars

Project → Settings → Environment Variables (Production; Preview too
if you test there). Copy each `price_...` id from the Price's detail
page:

```
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_BASIC_MONTHLY=price_...
STRIPE_PRICE_ID_PACK_SMALL=price_...
STRIPE_PRICE_ID_PACK_MEDIUM=price_...
STRIPE_PRICE_ID_PACK_LARGE=price_...
```

Redeploy after saving (env changes need a new deployment).

## 3. What flips on automatically

- **Basic Enroll** (on /upgrade + Settings) becomes a real Stripe
  Checkout; the webhook writes `profiles.subscription_tier='basic'`
  and Basic caps/quotas (100 msgs, 10 images, 3 identities) enforce
  themselves.
- **Pack Reserve** buttons become Checkout; on payment the webhook
  credits `profiles.message_credits` / `image_credits` by the pack
  size, and over-cap sends consume those credits automatically.
- **Basic → Pro upgrades** go through the Stripe billing portal
  (plan change on the existing subscription); the webhook syncs the
  tier from the new Price ID.

No webhook changes needed in the Stripe Dashboard — the existing
endpoint (`/api/stripe/webhook`) already subscribes to the relevant
events (`checkout.session.completed`, `customer.subscription.*`,
`invoice.*`, `charge.refunded`).
