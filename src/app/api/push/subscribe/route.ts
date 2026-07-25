import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { StoredPushSubscription } from "@/lib/webPush";

export const runtime = "nodejs";

/**
 * POST /api/push/subscribe — persist a Web Push subscription for the
 * signed-in user. Body: the PushSubscriptionJSON returned by
 * ServiceWorkerRegistration.pushManager.subscribe().toJSON().
 *
 * Client-side RLS can also do this write (0075 leaves push_subscription
 * user-writable), but going through this endpoint means the client
 * doesn't have to build a Supabase client just to store the blob and
 * we can validate the shape server-side.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<StoredPushSubscription>
    | null;
  if (
    !body ||
    typeof body.endpoint !== "string" ||
    typeof body.keys?.p256dh !== "string" ||
    typeof body.keys?.auth !== "string"
  ) {
    return NextResponse.json(
      { error: "Malformed subscription" },
      { status: 400 },
    );
  }

  const stored: StoredPushSubscription = {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  };

  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: stored })
    .eq("id", user.id);
  if (error) {
    console.error("[push/subscribe] update failed:", error);
    return NextResponse.json(
      { error: "Could not save subscription" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

/** Clear the stored subscription — the user opts out or the browser rotated. */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: null })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json(
      { error: "Could not clear subscription" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
