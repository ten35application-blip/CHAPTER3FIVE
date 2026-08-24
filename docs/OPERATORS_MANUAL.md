# chapter3five — Operator's Manual

**Purpose of this document:** if Wilson cannot run chapter3five —
temporarily or permanently — this is how Danisel and Pedro (or a
developer they hire) keep every family's archive alive and the
business running. The app's whole promise is that people don't
disappear all at once. Neither should the app.

**Print this. Fill in the CREDENTIALS section by hand on the printed
copy only — never type passwords into this file.** Store the printed
copy where Danisel keeps important papers.

_Last updated: 2026-08-26. Keep it current when anything major changes._

---

## 1. What the product is, in one paragraph

chapter3five lets people create AI companions: randomly generated
ones, ones built from a photo, and — the heart of it — **archives**: a
person answers 45 questions about themselves (or about someone they
love), and the result can be talked to. Archives mint **inherit
codes** that family members redeem ($4.99) to hold their own permanent
copy. Copies survive everything — even the creator deleting their
account. That promise is enforced by the database itself.

## 2. The moving parts and where they live

| What | Where | Account/identity |
|---|---|---|
| Web app + API (the brain) | Vercel — project `chapter-3-five` | ten35application@gmail.com (GitHub OAuth) |
| Database + storage + auth | Supabase — project `nljxcyssbcmhwjuyxley` | same |
| Source code | GitHub — chapter3five (web) + chapter3five-app (mobile) | same |
| iOS app | App Store Connect — Team `H727U5NUS7` | **Account Holder: Danisel Feliz** |
| Android app | Google Play Console — dev account `9134362018334900517` | support@chapter3five.app |
| Purchases middleware | RevenueCat — project `proj79891743` | same GitHub OAuth |
| Web payments | Stripe | (fill in on printed copy) |
| Email sending | Resend — domain chapter3five.app | same |
| AI providers | Anthropic (companion replies), OpenAI (moderation/memory search), Replicate (photos) | same |
| Mobile builds/updates | Expo/EAS — account `chapter3five` | ten35application@gmail.com |
| Domain | (fill in registrar on printed copy) | |

## 3. The bills that keep it alive

If these lapse, the app dies in this order: **Vercel/Supabase**
(instantly), **Anthropic** (companions stop answering), **Resend**
(emails stop), **Replicate** (photos stop), **Apple $99/yr** (app
eventually delisted), **domain** (everything unreachable).

Monthly cost at small scale: roughly $50–100 plus AI usage. AI usage
scales with users and is capped per-user by design; at $100k/month
revenue it runs ~$20–25k/month. **Never let the payment card on these
services die** — see the banking section of the punch-list memory:
when changing banks, update the card on every service BEFORE closing
the old account.

## 4. The daily safety nets (already automatic)

- **The vault email** (daily, ~3am ET): every archive, every inherit
  code, every holder copy, as a JSON attachment to the admin inboxes.
  ANY one of these emails is enough to rebuild every family's archive.
  Never delete them all; keep at least the last few weeks.
- **The ops digest** (daily, ~8am ET): one email — did the background
  jobs run, did any payment fail to land, are there crisis flags or
  user reports waiting, what was yesterday's revenue. **⚠️ in the
  subject means open it today.** Crisis flags mean a human being may
  be in danger — those are reviewed same-day, no exceptions.
- **The admin surface**: chapter3five.app/admin (admin accounts only)
  — users, revenue, grant failures, reports.

## 5. If something is broken and Wilson is unreachable

1. **The app is down** → status.vercel.com and status.supabase.com
   first (it may be them, not us). Then Vercel dashboard → latest
   deployment → "Redeploy". Most outages end there.
2. **A customer paid and didn't get their thing** → /admin → grant
   failures. Every failed grant is recorded with who and what. A
   developer (or support ticket to Stripe/RevenueCat) resolves from
   that record.
3. **Someone reports a stolen likeness / legal complaint** → the
   audit log holds the uploader's rights attestation (who affirmed,
   when, for which identity). Terms §conduct covers takedown. Delete
   the identity via /admin; no refund per Terms.
4. **The database is lost** (the nightmare) → most recent **vault
   email** has every archive and code. Supabase support can restore
   from backups if the paid plan is on. A hired developer + the vault
   JSON can rebuild the irreplaceable data even from nothing.
5. **You need a developer** → the code is documented for handoff.
   Give them this manual, the GitHub repos, and the memory files in
   the repo's audit trail. Everything unusual is explained in code
   comments at the place it happens.

## 6. Standing decisions (don't re-litigate without cause)

- Archives of the dead never break character except in crisis; Adrian
  and the legal pages carry the AI disclosure. This is deliberate.
- Inherit codes: revocation is the only kill switch; copies are
  forever; nobody verifies deaths; every redemption is paid.
- The stores bill users; the web bills through Stripe; prices end in
  .99 everywhere and must stay matched on all three surfaces.
- Free tier talks to Adrian + purchased/earned identities only.
- RLS + column allowlists on every user-reachable table — any new
  developer must read the migrations before touching the database.

## 7. CREDENTIALS (printed copy only — fill by hand)

| Service | Login | Password/notes | 2FA device |
|---|---|---|---|
| ten35application@gmail.com | | | |
| Vercel | | | |
| Supabase | | | |
| GitHub | | | |
| App Store Connect (Danisel) | | | |
| Play Console | | | |
| Stripe | | | |
| RevenueCat | | | |
| Resend | | | |
| Anthropic / OpenAI / Replicate | | | |
| Domain registrar | | | |
| Bank (Navy Federal) | | | |

**Recovery emails and 2FA:** make sure at least TWO of the three of
you can pass 2FA for the Gmail account above — it is the root of
almost everything else.
