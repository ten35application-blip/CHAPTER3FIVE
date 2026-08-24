"use client";

/** window.print() needs a client boundary; everything else on the
 *  keepsake page stays server-rendered. */
export function PrintButton() {
  return (
    <button
      type="button"
      className="keepsake-print-btn"
      onClick={() => window.print()}
    >
      Print this card
    </button>
  );
}
