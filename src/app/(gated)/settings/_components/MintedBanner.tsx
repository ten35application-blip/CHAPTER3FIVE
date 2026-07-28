"use client";

import { useEffect } from "react";

/**
 * One-time success banner rendered at the top of /settings when the
 * URL carries ?minted=<oracleId>. Fired by the legacy flow's
 * completeLegacyIdentity action on success so the user lands here
 * with a celebratory moment + a direct nudge to the Share paperplane
 * on the same page.
 *
 * The parent server component decides WHETHER to render (based on
 * ownership of the ID); this component's only client job is stripping
 * the query param on mount so a refresh doesn't re-fire the banner.
 * Using replaceState keeps the history entry intact.
 */
export function MintedBanner({ name }: { name: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("minted")) {
      url.searchParams.delete("minted");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <div
      role="status"
      className="mb-6 rounded-2xl bg-coral/10 px-4 py-4 ring-1 ring-coral/25"
    >
      <p className="text-sm leading-relaxed text-warm-50">
        You just wove{" "}
        <strong className="text-gradient-cta font-semibold">{name}</strong>{" "}
        together. Their inherit code is ready below &mdash; tap the paper
        plane to send it to family.
      </p>
    </div>
  );
}
