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
          {/* pl-16 pr-16 on mobile leaves room for both HomeChrome pills
              (avatar top-left, compose top-right). md+ drops them since
              the inline rightSlot returns and no global chrome. */}
          <div className="max-w-2xl mx-auto pl-16 pr-16 md:pl-6 md:pr-6 h-12 flex items-center justify-between gap-3">
            <span className="font-serif italic text-warm-50 text-base">
              {title}
            </span>
            <div className="scale-90 origin-right">{rightSlot}</div>
          </div>
          <div className="h-px bg-amber/40" />
        </div>
      </div>

      {/* Large title in the document flow. iMessage's large-title scale
          (~34px). Mobile: pad both sides to clear the avatar (left)
          and compose pill (right). md+: no global chrome, normal pad. */}
      <div className="flex items-end justify-between mb-6 mt-14 md:mt-0 px-2 gap-3">
        <h1 className="font-serif text-[34px] text-warm-50 leading-none tracking-tight">
          {title}
        </h1>
        {rightSlot}
      </div>
    </>
  );
}
