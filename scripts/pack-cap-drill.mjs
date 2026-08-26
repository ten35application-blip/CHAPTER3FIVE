import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(url, service);
const API = "https://chapter3five.app";
const EMAIL = "wfeliz2290+c35audit-android@gmail.com";
const ORACLE = "37e4a2d1-ad29-4896-921d-45250db0eb34"; // Camille (test acct)

const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
const u = users.users.find((x) => x.email === EMAIL);
if (!u) throw new Error("test user missing");

// STAGE: free tier, reward-flagged companion (chattable on Free),
// usage AT the free cap (20), zero pack credits.
await admin.from("profiles").update({ pro_until: null, plan_source: null }).eq("id", u.id);
await admin.from("oracles").update({ is_referral_reward: true }).eq("id", ORACLE);
const period = new Date(); // current_usage period key — align to its expectation
const { data: cur } = await admin.rpc("current_usage", { target_user_id: u.id }).maybeSingle();
console.log("0. current ledger:", JSON.stringify(cur));
const periodKey = cur?.period_start ?? new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1)).toISOString();
await admin.from("monthly_usage").upsert({ user_id: u.id, period: periodKey.slice(0,10), messages: 20, images: 0 }, { onConflict: "user_id,period" });
await admin.from("profiles").update({ message_credits: 0 }).eq("id", u.id);
console.log("1. staged: FREE tier, usage=20/20, credits=0");

// Session
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const anon = createClient(url, anonKey);
const { data: sess, error: otpErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
if (otpErr) throw otpErr;
const token = sess.session.access_token;

async function send(text) {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ oracle_id: ORACLE, message: text, history: [{role:"user",content:"hi"},{role:"assistant",content:"hey"}], timezone: "America/New_York" }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, error: body.error, gotReply: typeof body.reply === "string" && body.reply.length > 0 };
}

// 2. At cap, no credits → must 402
let r = await send("cap drill one");
console.log("2. at cap, 0 credits →", r.status, r.error, "(expect 402 free_month_cap)");

// 3. Grant a 2-credit "pack" → must flow
await admin.rpc("increment_profile_counter", { target_user_id: u.id, counter_name: "message_credits", delta: 2 });
r = await send("cap drill two");
const { data: c1 } = await admin.from("profiles").select("message_credits").eq("id", u.id).single();
console.log("3. with pack →", r.status, "reply:", r.gotReply, "| credits now", c1.message_credits, "(expect 200, credits 1)");

// 4. Second credit
r = await send("cap drill three");
const { data: c2 } = await admin.from("profiles").select("message_credits").eq("id", u.id).single();
console.log("4. last credit →", r.status, "reply:", r.gotReply, "| credits now", c2.message_credits, "(expect 200, credits 0)");

// 5. Drained → must 402 again
r = await send("cap drill four");
console.log("5. pack drained →", r.status, r.error, "(expect 402 free_month_cap)");

console.log("PACK-CAP DRILL COMPLETE");
