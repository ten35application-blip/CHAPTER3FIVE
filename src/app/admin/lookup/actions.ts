"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function lookupUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    redirect("/");
  }

  const q = String(formData.get("q") ?? "").trim();
  if (!q) {
    redirect("/admin?error=Empty%20search");
  }

  // UUID — go straight to user page.
  if (UUID_RE.test(q)) {
    redirect(`/admin/user/${q}`);
  }

  // Email — find via service-role auth admin.
  const admin = createAdminClient();
  const lower = q.toLowerCase();

  // listUsers is paginated; for V1 walk up to 5 pages of 100.
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      redirect(`/admin?error=${encodeURIComponent(error.message)}`);
    }
    const found = data?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === lower,
    );
    if (found) {
      redirect(`/admin/user/${found.id}`);
    }
    if (!data?.users || data.users.length < 100) break;
  }

  redirect(`/admin?error=No%20user%20found%20for%20${encodeURIComponent(q)}`);
}
