"use client";

import { useEffect } from "react";

/**
 * Dashboard success banner for post-purchase returns. Rendered when
 * the URL carries ?pack=1 (pack purchase) or ?upgraded=1 (subscription
 * upgrade). Strips the query param on mount so a refresh doesn't
 * re-show the banner and the URL stays clean.
 *
 * Fable payment audit 2026-07-28: without this the dashboard was
 * silently ignoring the success signal — user paid, Stripe redirected
 * them here, but nothing on the page acknowledged the purchase. That
 * left buyers wondering if the transaction went through.
 */
export function PurchaseToast({ kind }: { kind: "pack" | "upgraded" }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let touched = false;
    if (url.searchParams.has("pack")) {
      url.searchParams.delete("pack");
      touched = true;
    }
    if (url.searchParams.has("upgraded")) {
      url.searchParams.delete("upgraded");
      touched = true;
    }
    if (touched) {
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <div
      role="status"
      className="mx-4 mt-3 rounded-2xl bg-teal/10 px-4 py-3 ring-1 ring-teal/25"
    >
      <p className="text-sm font-medium leading-relaxed text-teal-strong">
        {kind === "pack"
          ? "Pack added — extra messages and photos credited to your account."
          : "You’re upgraded. Enjoy the extra room this month."}
      </p>
    </div>
  );
}
