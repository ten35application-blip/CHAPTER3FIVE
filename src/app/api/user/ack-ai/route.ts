import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records the user's one-time acknowledgment of the AI-nature
 * disclosure shown before their first send to Adrian (the concierge).
 * Stamps profiles.first_launch_ai_ack_at (0124). Google Play's
 * Generative AI policy expects a visible in-context signal that the
 * counterparty is AI; Wilson's product rule keeps AI wording out of
 * the normal chat surface. This endpoint locks the one-time modal so
 * it never re-fires for the same user.
 *
 * Idempotent: a second POST is a no-op (does not overwrite the
 * existing timestamp). Server-side write via admin client because
 * the column is intentionally not in the authenticated UPDATE
 * grant — clients can't reset the flag by crafting a PATCH.
 */
export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  // Only stamp if currently null — a second POST is a no-op so the
  // audit stamp preserves the ORIGINAL acknowledgment moment. If the
  // column doesn't exist (migration not run), the update surfaces
  // clearly in logs; the client still degrades gracefully because
  // failure returns 500 and the modal closes on its own path.
  const { error } = await admin
    .from("profiles")
    .update({ first_launch_ai_ack_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("first_launch_ai_ack_at", null);

  if (error) {
    console.error("[ack-ai] update failed:", error);
    return NextResponse.json({ error: "ack_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
