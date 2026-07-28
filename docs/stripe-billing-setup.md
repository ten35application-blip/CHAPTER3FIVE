# Stripe billing setup — Basic tier + add-on packs + inherit slot

The code for the three-tier + packs + inherit-slot model is fully
wired (checkout, webhook, credit balances, UI). Each surface
activates itself the moment its Price ID env var exists — until then
it shows the mailto fallback. To turn everything on:

## 1. Create the Products/Prices in the Stripe Dashboard

Product catalog → Add product. Six Prices total (Pro may already
exist — but see the price-drop note below):

| Product name (suggested)     | Price   | Type                | Env var                          |
| ---------------------------- | ------- | ------------------- | -------------------------------- |
| chapter3five Pro             | $10.00  | Recurring, monthly  | `STRIPE_PRICE_ID_PRO_MONTHLY`    |
| chapter3five Basic           | $5.00   | Recurring, monthly  | `STRIPE_PRICE_ID_BASIC_MONTHLY`  |
| chapter3five Small pack      | $5.00   | One-time            | `STRIPE_PRICE_ID_PACK_SMALL`     |
| chapter3five Medium pack     | $10.00  | One-time            | `STRIPE_PRICE_ID_PACK_MEDIUM`    |
| chapter3five Large pack      | $20.00  | One-time            | `STRIPE_PRICE_ID_PACK_LARGE`     |
| chapter3five Inherited Slot  | $5.00   | One-time            | `STRIPE_PRICE_ID_INHERITED_SLOT` |

Notes:

- **Pro dropped $12 → $10 (July 2026 second rework).** Stripe Prices
  are immutable: if a $12 Pro Price already exists, add a NEW $10.00
  monthly Price on the same Pro Product, point
  `STRIPE_PRICE_ID_PRO_MONTHLY` at the new `price_...` id, and
  archive the old Price. Existing $12 subscribers stay on the old
  Price until you migrate them (Subscription → Update → change
  price), so decide whether to grandfather or migrate.
- **Inherited Slot** is the one-time unlock for redeeming an inherit
  code minted by a LIVING creator ($5, once per code). Deceased-
  minter codes are free in-app (the memorial waiver) and never reach
  checkout. The webhook credits `profiles.inherited_slot_credits`
  by 1 per purchase; the redeem action consumes 1 per code.
- One pack Product per size is enough — whether the buyer gets
  messages or images is decided in OUR UI and rides through checkout
  metadata (`pack_type`), not through separate Stripe Prices.
- Amounts must match `src/lib/pricing.ts` (`monthlyCents`,
  `basicMonthlyCents`, `packSmallCents`, `packMediumCents`,
  `packLargeCents`, `inheritedSlotPurchaseCents`). If a price ever
  changes, change it in BOTH places.
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
STRIPE_PRICE_ID_INHERITED_SLOT=price_...
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
  (plan change on the existing subscription; CTAs on /upgrade and in
  Settings); the webhook syncs the tier from the new Price ID.
- **Inherit-slot unlock** (/upgrade?reason=inherited-slot, where the
  redeem gate sends credit-less users) becomes a real Checkout;
  success returns the buyer to /identity/inherit to enter their
  code. Refunds claw the credit back (floored at 0 if already
  spent).

No webhook changes needed in the Stripe Dashboard — the existing
endpoint (`/api/stripe/webhook`) already subscribes to the relevant
events (`checkout.session.completed`, `customer.subscription.*`,
`invoice.*`, `charge.refunded`).
