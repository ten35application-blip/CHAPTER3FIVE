"use client";

import { useTransition } from "react";
import { exportPaymentsCsv, exportSettlementsCsv } from "./actions";

/** Calls the export server action and downloads the returned CSV. */
export function ExportCsvButton({
  kind = "payments",
}: {
  kind?: "payments" | "settlements";
}) {
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const { filename, csv } =
        kind === "settlements"
          ? await exportSettlementsCsv()
          : await exportPaymentsCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={pending}
      className="bg-gradient-cta rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_28px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:opacity-90 disabled:opacity-50"
    >
      {pending ? "Preparing…" : kind === "settlements" ? "Months CSV" : "Export CSV"}
    </button>
  );
}
