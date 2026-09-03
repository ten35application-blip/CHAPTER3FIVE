import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { loadSettings } from "@/lib/admin/monthBreakdown";
import { parseDollarsToCents } from "@/lib/admin/marketingReports";
import {
  deleteTaxPayment,
  fetchTaxPayments,
  recordTaxPayment,
} from "@/lib/admin/taxPayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estimated-tax payments sent in a member's name — the mobile app's
 * way to record one (the web form uses the server action in
 * /admin/revenue/actions.ts; both write through
 * src/lib/admin/taxPayments.ts). The month breakdown carries the
 * payments it counted, so the card needs no separate read.
 *
 * GET                               → history, newest first (≤ 200)
 * POST { partner, paidOn, amount | amountCents, government, note? }
 *                                   → insert; `amount` is dollars ("1,234.56")
 * DELETE ?id=<uuid>                 → remove one, only while its month is live
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  return NextResponse.json({ payments: await fetchTaxPayments(gate.admin) });
}

export async function POST(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let body: {
    partner?: unknown;
    paidOn?: unknown;
    amount?: unknown;
    amountCents?: unknown;
    government?: unknown;
    note?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const amountCents =
    typeof body.amountCents === "number" && Number.isInteger(body.amountCents)
      ? body.amountCents
      : typeof body.amount === "string"
        ? parseDollarsToCents(body.amount)
        : null;
  if (amountCents === null) {
    return NextResponse.json({ error: "amount must be a dollar amount like 1234.56" }, { status: 400 });
  }
  try {
    const settings = await loadSettings(gate.admin);
    const payment = await recordTaxPayment(gate.admin, {
      partner: typeof body.partner === "string" ? body.partner : "",
      paidOn: typeof body.paidOn === "string" ? body.paidOn : "",
      amountCents,
      government: typeof body.government === "string" ? body.government : "",
      note: typeof body.note === "string" ? body.note : null,
      recordedBy: gate.user.email ?? null,
      partnerNames: [settings.partner_a, settings.partner_b],
    });
    return NextResponse.json({ ok: true, payment });
  } catch (err) {
    console.error("[tax-payment] record failed:", err);
    return NextResponse.json({ error: safeMessage(err) }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  try {
    await deleteTaxPayment(gate.admin, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tax-payment] delete failed:", err);
    return NextResponse.json({ error: safeMessage(err) }, { status: 400 });
  }
}

/** The lib's own validation messages are plain English and safe to
 *  show; anything else (a database error) is not. */
function safeMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  const ours =
    /^(partner must be|paid on|amount must|government must|note is too long|bad id|that payment)/.test(m);
  return ours ? m : "Could not save the payment — try again.";
}
