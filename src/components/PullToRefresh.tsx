"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Page content. Wrapped — pull gesture detection lives on the
      whole page so users can pull from anywhere near the top. */
  children: React.ReactNode;
};

const TRIGGER_THRESHOLD = 90;
const MAX_PULL = 150;

/**
 * Pull-to-refresh that lives over the dashboard. Twist: instead of
 * the iOS rubber-band circular spinner, the indicator is a small
 * amber dot that grows + pulses with the pull, becoming the
 * chapter3five orb's signature glow when the threshold is crossed.
 *
 * On release past threshold → router.refresh() to refetch the
 * server-rendered conversation list. Reverts to idle once the
 * navigation transition completes.
 */
export function PullToRefresh({ children }: Props) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef<boolean>(false);

  function onTouchStart(e: TouchEvent) {
    // Only start a pull if the page is at the very top.
    if (window.scrollY > 0) return;
    if (e.touches.length !== 1) return;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Resistance: pull feels heavier the further down you go.
    const eased = Math.min(MAX_PULL, dy * 0.55);
    setPull(eased);
  }

  function onTouchEnd() {
    if (!tracking.current) return;
    tracking.current = false;
    startY.current = null;
    if (pull >= TRIGGER_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(TRIGGER_THRESHOLD);
      router.refresh();
      // Reset after a short window — server-render arrives fast,
      // we just want the visual to land.
      setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, 700);
    } else {
      setPull(0);
    }
  }

  useEffect(() => {
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pull, refreshing]);

  // Visual: an amber dot that grows + brightens with the pull. At
  // threshold it locks at full brightness; while refreshing it
  // gently pulses.
  const progress = Math.min(1, pull / TRIGGER_THRESHOLD);
  const dotSize = 4 + progress * 14; // 4px → 18px
  const opacity = 0.3 + progress * 0.7;
  const glow = 4 + progress * 18;

  return (
    <>
      <div
        aria-hidden
        style={{
          height: pull,
          transition:
            tracking.current || refreshing
              ? "none"
              : "height 200ms ease-out",
        }}
        className="flex items-end justify-center overflow-hidden pointer-events-none"
      >
        <div
          style={{
            width: dotSize,
            height: dotSize,
            opacity,
            boxShadow: `0 0 ${glow}px ${glow / 2}px rgba(255, 216, 160, ${opacity * 0.4})`,
          }}
          className={`rounded-full bg-amber mb-3 ${
            refreshing ? "animate-pulse" : ""
          }`}
        />
      </div>

      <div
        style={{
          transform: `translateY(${pull * 0.3}px)`,
          transition:
            tracking.current || refreshing
              ? "none"
              : "transform 200ms ease-out",
        }}
      >
        {children}
      </div>
    </>
  );
}
