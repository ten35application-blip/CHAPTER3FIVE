import { NextResponse, type NextRequest } from "next/server";

/**
 * chapter3five.app/join/CODE — the shareable half of the referral.
 *
 * A ROUTE HANDLER, not a page calling redirect(). In a streaming
 * render, redirect() doesn't emit a 307 — it ships an HTML document
 * carrying <meta http-equiv="refresh">, which means the visitor sees
 * the rendered shell for a full second first. That shell is the
 * not-found page, so every person a user referred would have met
 * chapter3five with the words "We couldn't find that" before landing
 * on signup (found 2026-08-21, testing the live link). A handler
 * returns a real redirect with no body at all.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = (code ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
  return NextResponse.redirect(
    new URL(clean ? `/auth/signup?ref=${clean}` : "/auth/signup", request.url),
  );
}
