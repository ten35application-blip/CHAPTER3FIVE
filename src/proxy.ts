import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/admin";

const ADMIN_PATH_RE = /^\/admin(\/|$)/;

export async function proxy(request: NextRequest) {
  // Always refresh the Supabase session on every request.
  const response = await updateSession(request);

  // Edge-level guard for /admin/*. Defense-in-depth: every admin page
  // already does its own server-side isAdmin() check + redirect, but
  // gating at the proxy means a non-admin never even gets the page
  // shell rendered. Returns 404 so the path doesn't leak its existence.
  if (ADMIN_PATH_RE.test(request.nextUrl.pathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
