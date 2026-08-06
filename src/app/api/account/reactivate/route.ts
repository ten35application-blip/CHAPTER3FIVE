import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { reactivateAccount } from "@/lib/account/reactivate";

export const runtime = "nodejs";

/**
 * The phone's half of the reactivation promise.
 *
 * Mobile's dashboard used to detect profiles.deleted_at and silently
 * sign the user out onto the landing page — no explanation, no way
 * back, while /account-deleted was promising "sign back in and it
 * reactivates." Now the app shows a real choice, and its Reactivate
 * button lands here.
 *
 * allowSoftDeleted is the whole point: the shared Bearer gate
 * (mobileAuth) returns user:null for deleted accounts on every other
 * route, which is correct everywhere except the one endpoint whose
 * job is to un-delete.
 */
export async function POST(request: Request) {
  const { user } = await getRequestAuth(request, { allowSoftDeleted: true });
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  const result = await reactivateAccount(user.id);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          "That didn't go through. Give it a second and try again — your account is still safe until its scheduled date.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
