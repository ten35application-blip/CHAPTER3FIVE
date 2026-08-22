import { NextResponse, type NextRequest } from "next/server";

/**
 * /cookies → the cookie section of the privacy policy. A route
 * handler for the same reason /join/[code] is one: a page calling
 * redirect() flashes the rendered shell first (see that file).
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/privacy#cookies", request.url));
}
