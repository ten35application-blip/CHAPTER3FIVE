import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/admin";

const ADMIN_PATH_RE = /^\/admin(\/|$)/;

// Pages a soft-deleted user IS allowed to reach (so they can restore,
// view legal docs, sign out, or read their own about/landing). Everything
// else for a soft-deleted user redirects to /restore.
const SOFT_DELETED_ALLOWED = [
  "/restore",
  "/account-deleted",
  "/auth",
  "/api/stripe",
  "/api/user/export",
  "/terms",
  "/privacy",
  "/cookies",
  "/about",
  "/support",
  "/how",
  "/sample",
  "/api/sample-chat",
];

function isSoftDeletedAllowed(pathname: string): boolean {
  if (pathname === "/" || pathname === "/landing") return true;
  return SOFT_DELETED_ALLOWED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Build a Supabase server client that mutates the given response so any
 * refresh-token rotation Supabase decides to do here actually persists
 * to the user's browser. The earlier version used `setAll() {}` (no-op)
 * which silently dropped rotated cookies — the user would eventually
 * end up signed out for no clear reason.
 */
function clientFor(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
}

export async function proxy(request: NextRequest) {
  // Always refresh the Supabase session on every request.
  const response = await updateSession(request);

  const pathname = request.nextUrl.pathname;

  // Edge-level guard for /admin/*. Defense-in-depth: every admin page
  // already does its own server-side isAdmin() check + redirect, but
  // gating at the proxy means a non-admin never even gets the page
  // shell rendered. Returns 404 so the path doesn't leak its existence.
  if (ADMIN_PATH_RE.test(pathname)) {
    const supabase = clientFor(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
    return response;
  }

  // Soft-deleted-user redirect. If the caller's profile.deleted_at is set
  // and they're trying to use the app proper, send them to /restore. They
  // can still read public pages, sign out, hit the export endpoint, and
  // pay to restore.
  if (!isSoftDeletedAllowed(pathname)) {
    const supabase = clientFor(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("deleted_at")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.deleted_at) {
        return NextResponse.redirect(new URL("/restore", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
