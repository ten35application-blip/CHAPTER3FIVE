import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, service);
const API = "https://chapter3five.app";
const DEMO = "demo@chapter3five.app";

const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
const demo = users.users.find((u) => u.email === DEMO);
if (!demo) throw new Error("demo user not found");

// Mint a real session for the demo user (generateLink + verifyOtp).
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink", email: DEMO,
});
if (linkErr) throw linkErr;
const anon = createClient(url, anonKey);
const { data: sess, error: otpErr } = await anon.auth.verifyOtp({
  token_hash: link.properties.hashed_token, type: "email",
});
if (otpErr) throw otpErr;
const token = sess.session.access_token;
console.log("1. session minted for", DEMO);

// Baseline credits
const { data: before } = await admin.from("profiles").select("message_credits").eq("id", demo.id).single();
console.log("2. message_credits before:", before.message_credits);

// Plant a gift
const { data: g } = await admin.from("admin_gifts")
  .insert({ user_id: demo.id, kind: "message_pack", note: "audit drill" })
  .select("id").single();
console.log("3. gift planted:", g.id);

// User sees it
let res = await fetch(`${API}/api/gifts`, { headers: { Authorization: `Bearer ${token}` } });
let body = await res.json();
console.log("4. GET /api/gifts:", res.status, JSON.stringify(body.gifts?.map(x=>x.kind)));

// Claim it
res = await fetch(`${API}/api/gifts/claim`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ gift_id: g.id }),
});
console.log("5. claim:", res.status, JSON.stringify(await res.json()));

// Credits after
const { data: after } = await admin.from("profiles").select("message_credits").eq("id", demo.id).single();
console.log("6. message_credits after:", after.message_credits, "(delta", after.message_credits - before.message_credits + ")");

// Replay attack — must NOT double-grant
res = await fetch(`${API}/api/gifts/claim`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ gift_id: g.id }),
});
console.log("7. replay claim:", res.status, "(expect 409)");
const { data: after2 } = await admin.from("profiles").select("message_credits").eq("id", demo.id).single();
console.log("8. credits after replay:", after2.message_credits, "(unchanged =", after2.message_credits === after.message_credits + ")");

// Cross-user theft — demo tries to claim WILSON's pending gift
const { data: wg } = await admin.from("admin_gifts").select("id").eq("user_id", "df17583b-b3ae-418d-84b2-168c27c72ab5").is("claimed_at", null).limit(1);
if (wg?.length) {
  res = await fetch(`${API}/api/gifts/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ gift_id: wg[0].id }),
  });
  console.log("9. steal Wilson's gift:", res.status, "(expect 409)");
} else { console.log("9. (Wilson's gift already claimed — steal test skipped)"); }

// RLS: authed client tries to WRITE a gift directly — must fail
const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
const { error: insErr } = await userClient.from("admin_gifts").insert({ user_id: demo.id, kind: "pro_month" });
console.log("10. user self-gifting via DB:", insErr ? `BLOCKED ✓ (${insErr.code})` : "!!! ALLOWED — BUG");

// Unauthed pending fetch
res = await fetch(`${API}/api/gifts`);
console.log("11. anon GET /api/gifts:", res.status, "(expect 401)");
console.log("DRILL COMPLETE");
