import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { fetchAdminHome } from "@/lib/admin/home";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The three-drawer admin's data, served to the mobile app. Same
 *  fetchAdminHome the web page renders — one truth, two screens. */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await fetchAdminHome(gate.admin));
}
