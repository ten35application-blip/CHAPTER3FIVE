/**
 * SIGNUP-PROMO DRY RUN (Wilson 2026-09-01: "do a dry run to confirm
 * it works as it's supposed to"). Walks the EXACT path a real signup
 * will walk, against production:
 *
 *   1. a drill promo goes live (quota 1)
 *   2. a brand-new account is created (after starts_at - qualifies)
 *   3. first app open  -> GET /api/gifts     -> gift + share link?
 *   4. presses Okay    -> POST /api/gifts/claim -> companion minted?
 *   5. reopens the app -> GET /api/gifts     -> no second grant?
 *   6. a SECOND new account signs up          -> quota gone, no gift?
 *   7. every trace deleted.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SECRET_KEY);
const API = "https://chapter3five.app";
const results = [];
const check = (step, got, expected) =>
  results.push({ step, got: String(got), expected: String(expected), pass: String(got) === String(expected) });

async function newUser(tag) {
  const email = `drill+promo-${tag}-${Date.now()}@chapter3five.app`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error("createUser: " + error.message);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: sess, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token, type: "email",
  });
  if (otpErr) throw new Error("verifyOtp: " + otpErr.message);
  return { id: data.user.id, email, token: sess.session.access_token };
}
const gifts = async (t) =>
  (await (await fetch(`${API}/api/gifts`, { headers: { Authorization: `Bearer ${t}` } })).json());

// 1. drill promo, quota 1
await admin.from("signup_promos").update({ enabled: false }).eq("enabled", true);
const { data: promo, error: pErr } = await admin.from("signup_promos")
  .insert({ label: "DRY RUN - delete me", kind: "companion", quota: 1, enabled: true })
  .select().single();
if (pErr) throw new Error("promo insert: " + pErr.message);

let u1, u2;
try {
  // 2-3. new account's first open
  u1 = await newUser("a");
  let body = await gifts(u1.token);
  const gift = body.gifts?.[0];
  check("gift granted on first open", gift?.kind, "companion");
  check("gift carries promo id", Boolean(gift?.promo_id), true);
  check("share code arrives WITH the gift", Boolean(body.referral?.code), true);
  check("share goal is 5", body.referral?.goal, 5);

  // 4. press Okay
  const claim = await fetch(`${API}/api/gifts/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${u1.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ gift_id: gift.id }),
  });
  check("claim succeeds", claim.status, 200);

  const { data: oracle } = await admin.from("oracles")
    .select("id, is_referral_reward").eq("user_id", u1.id)
    .eq("is_referral_reward", true).maybeSingle();
  check("companion minted, reward-stamped", Boolean(oracle), true);

  // 5. reopen - no double grant
  body = await gifts(u1.token);
  check("no second grant on reopen", body.gifts?.length ?? 0, 0);

  // 6. quota exhausted for the next signup
  u2 = await newUser("b");
  body = await gifts(u2.token);
  check("second signup after quota: no gift", body.gifts?.length ?? 0, 0);

  const { data: after } = await admin.from("signup_promos").select("claimed, quota").eq("id", promo.id).single();
  check("counter reads 1 of 1", `${after.claimed}/${after.quota}`, "1/1");
} finally {
  // 7. cleanup, always
  await admin.from("signup_promos").delete().eq("id", promo.id);
  for (const u of [u1, u2].filter(Boolean)) {
    await admin.from("oracles").delete().eq("user_id", u.id);
    await admin.from("admin_gifts").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
  const { count } = await admin.from("signup_promos").select("id", { count: "exact", head: true }).eq("label", "DRY RUN - delete me");
  check("cleanup: promo gone", count ?? 0, 0);
}

for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.step}  (got ${r.got}, want ${r.expected})`);
console.log(results.every((r) => r.pass) ? "\nALL CHECKS PASSED" : "\nFAILURES PRESENT");
