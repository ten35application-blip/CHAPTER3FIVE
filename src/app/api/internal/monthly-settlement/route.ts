import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import { authorizeCronTick } from "@/lib/cronTick";
import {
  fetchMonthBreakdown,
  normalizeMonthParam,
} from "@/lib/admin/monthBreakdown";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * THE MONTHLY SETTLEMENT (Wilson 2026-08-26): on the 27th of every
 * month, the owners get the month's money answered by email — what
 * Anthropic and Replicate took on auto-pay, what stays in the account
 * for bills, what Pedro and Danisel each transfer to their banks, and
 * what each sends on to savings for taxes (Bethlehem PA working rate
 * until Pedro confirms from the filings). Same fetchMonthBreakdown the
 * admin Revenue screens render — one formula everywhere.
 *
 * Scheduled by pg_cron ('monthly-settlement', 27th 13:00 UTC ≈ 9am
 * ET); the tick gate makes outside calls harmless (idempotent-ish:
 * worst case a duplicate email 20h later, and the gate prevents even
 * that within the window).
 */
export async function GET(request: NextRequest) {
  if (!(await authorizeCronTick(request, "monthly_settlement", 20 * 60))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const month = normalizeMonthParam(null); // current month, through today
  const b = await fetchMonthBreakdown(admin, month);
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  const pct = Math.round(b.taxReserveRate * 100);

  const expenseLines = b.expenses
    .map((e) => `  ${e.name}: −${usd(e.cents)}`)
    .join("\n");

  const verdict =
    b.profitCents > 0
      ? `${b.partnerA} — transfer to bank account: ${usd(b.transferPerPartnerCents)}
${b.partnerB} — transfer to bank account: ${usd(b.transferPerPartnerCents)}

After the bank transfer: each sends ${usd(b.taxSavingsPerPartnerCents)} to savings for taxes (${pct}%) — leaving ${usd(b.perPartnerCents)} each to spend.

Stays in the business account: ${usd(b.keepInAccountCents)} for next month's bills.`
      : `No profit to split this month — nothing transfers out. The account still covers ${usd(b.keepInAccountCents)} of next month's bills.`;

  const timing =
    b.storeNetCents > 0
      ? `\nTiming: ${usd(b.webNetCents)} arrives within days (web). ${usd(b.storeNetCents)} is store money — Apple pays about a month behind, Google mid-next-month. Transfer after it lands.\n`
      : "";

  const body = `${b.monthLabel} — the month, settled (through today)

Customers paid: ${usd(b.grossCents)}
Apple/Google keep (est.): −${usd(b.storeCommissionCents)}
Stripe keeps (est.): −${usd(b.webProcessingCents)}
Reaches the bank: ${usd(b.netReceiptsCents)}

What running the place cost (auto-pay already took these):
${expenseLines}

Profit: ${usd(b.profitCents)}

${verdict}
${timing}
Estimates, not tax advice — the ${pct}% reserve is the Bethlehem PA working guess until Pedro confirms the real rate with the filings. The full breakdown lives in Admin → Revenue.

— your app, settling the month. https://chapter3five.app/admin/revenue`;

  let sent = 0;
  for (const to of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "chapter3five <safety@chapter3five.app>",
        to,
        subject: `💰 ${b.monthLabel} settled — ${
          b.profitCents > 0
            ? `${usd(b.transferPerPartnerCents)} each to transfer`
            : "no profit to split yet"
        }`,
        text: body,
      });
      sent++;
    } catch (err) {
      console.error(`[monthly-settlement] send to ${to} failed:`, err);
    }
  }

  await admin.from("cron_runs").insert({
    job: "monthly-settlement",
    processed: sent,
    status: sent > 0 ? "ok" : "error",
    error: sent === 0 ? "no settlement email delivered" : null,
  });

  return NextResponse.json({ ok: true, sent });
}
