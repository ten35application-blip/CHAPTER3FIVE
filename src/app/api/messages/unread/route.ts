import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Count messages from the active oracle that arrived after a given
 * timestamp — used by the dashboard's UserMenu badge to show new
 * proactive messages.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  if (!since) return NextResponse.json({ count: 0 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id")
    .eq("id", user.id)
    .single();

  if (!profile?.active_oracle_id) return NextResponse.json({ count: 0 });

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("oracle_id", profile.active_oracle_id)
    .eq("role", "assistant")
    .gt("created_at", since);

  return NextResponse.json({ count: count ?? 0 });
}
