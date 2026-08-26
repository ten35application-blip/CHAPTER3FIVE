"use client";

/** Print / Save-as-PDF for the settlement statement — the browser's
 *  print dialog has "Save as PDF" built in on every platform, so this
 *  one button IS the PDF export. Hidden on paper via print:hidden. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-teal-strong px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
