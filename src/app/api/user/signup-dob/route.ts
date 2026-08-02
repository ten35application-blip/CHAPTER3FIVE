import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Mobile-signup DOB writer. Web collects date_of_birth on the signup
 * form and persists it via admin client (0090 denylist blocks PATCH
 * from the anon key). Mobile signs up client-side with
 * supabase.auth.signUp, then calls this endpoint with the DOB it
 * collected on its own form.
 *
 * Idempotent per user + validated (18+, not future, not >120y ago).
 */

function ageOnDate(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() &&
      on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request
    .json()
    .catch(() => ({}) as { date_of_birth?: unknown });
  const raw =
    typeof body.date_of_birth === "string" ? body.date_of_birth.trim() : "";
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return NextResponse.json(
      { error: "Enter your date of birth as YYYY-MM-DD." },
      { status: 400 },
    );
  }
  const dob = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json(
      { error: "That date of birth doesn't look right." },
      { status: 400 },
    );
  }
  const now = new Date();
  if (dob > now) {
    return NextResponse.json(
      { error: "Date of birth can't be in the future." },
      { status: 400 },
    );
  }
  const age = ageOnDate(dob, now);
  if (age < 18) {
    return NextResponse.json(
      { error: "You have to be 18 or older to use chapter3five." },
      { status: 400 },
    );
  }
  if (age > 120) {
    return NextResponse.json(
      { error: "That date of birth doesn't look right." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ date_of_birth: raw })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't save your date of birth. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
