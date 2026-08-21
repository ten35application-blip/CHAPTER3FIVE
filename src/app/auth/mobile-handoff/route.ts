import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

/**
 * Mobile → web session handoff.
 *
 * Mobile opens `chapter3five.app/auth/mobile-handoff?access_token=…
 * &refresh_token=…&next=/admin` in the system browser. We call
 * supabase.auth.setSession with the tokens — that writes the Supabase
 * SSR cookies to the response — then 302 to `next`, so the user lands
 * on the target page already authenticated.
 *
 * Trade-offs (intentional):
 *   - Tokens travel in a URL query string. They also leak into browser
 *     history + server access logs. Acceptable for a user-initiated
 *     handoff into a page the mobile client already trusts; not
 *     acceptable for programmatic API calls (those keep using Bearer).
 *   - `next` is validated to a same-site absolute path so a malicious
 *     link can't redirect to an external phishing target.
 *
 * Callers: mobile Admin row (dashboard.tsx). Future: any "open this
 * web page inside your session" button on mobile.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");
  const nextRaw = url.searchParams.get("next") ?? "/dashboard";
  // Whitelist: same-site absolute paths only.
  const next =
    typeof nextRaw === "string" &&
    nextRaw.startsWith("/") &&
    !nextRaw.startsWith("//")
      ? nextRaw
      : "/dashboard";

  if (!accessToken || !refreshToken) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  // Cookie jar, same fix as /auth/confirm (2026-08-21). The doc comment
  // above claimed setSession "writes the Supabase SSR cookies to the
  // response" — it wrote them into Next's cookie store, which the
  // freshly-built NextResponse.redirect() below never carried. So the
  // handoff appeared to work and landed the user signed OUT.
  const jar: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          jar.push(...cookiesToSet);
        },
      },
    },
  );
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  const res = NextResponse.redirect(new URL(next, request.url));
  for (const c of jar) res.cookies.set(c.name, c.value, c.options);
  return res;
}
