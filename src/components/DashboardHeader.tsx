"use client";

import { useEffect, useState } from "react";

type Props = {
  title: string;
  /** Right-side slot for the compose button. */
  rightSlot: React.ReactNode;
};

/**
 * iOS-style large title that gracefully shrinks on scroll, plus a
 * small condensed bar that fades in once the big title leaves the
 * viewport. Twist: instead of the system-flat iOS look, our
 * condensed bar uses serif italic for the title and our amber as
 * the underline accent — distinct from the gray-on-gray Apple
 * treatment.
 *
 * The compose button sits in the same slot in both states; just
 * different sizing.
 */
export function DashboardHeader({ title, rightSlot }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 56);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Condensed sticky bar — fades + slides in when scrolled. */}
      <div
        aria-hidden={!scrolled}
        className={`fixed top-0 inset-x-0 z-30 transition-all duration-200 ${
          scrolled
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-ink/80 backdrop-blur-md border-b border-warm-700/60">
          <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between gap-3">
            <span className="font-serif italic text-warm-50 text-base">
              {title}
            </span>
            {/* Smaller version of the right slot — same content, just
                let the consumer style for both states. */}
            <div className="scale-90 origin-right">{rightSlot}</div>
          </div>
          <div className="h-px bg-amber/40" />
        </div>
      </div>

      {/* Large title in the document flow. */}
      <div className="flex items-end justify-between mb-5 px-2 gap-3">
        <h1 className="font-serif text-3xl text-warm-50 leading-none">
          {title}
        </h1>
        {rightSlot}
      </div>
    </>
  );
}
