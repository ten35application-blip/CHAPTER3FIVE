"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createIdentity } from "./actions";

/**
 * Kicks off createIdentity() the moment the reveal page mounts without
 * a ?id= param, and renders the "Meeting someone new…" loader while
 * the server action runs. The action's redirect() navigates the page
 * to ?id=<new_id> when done.
 *
 * useRef guard prevents React strict mode's double-invoke from firing
 * two generations back-to-back in dev.
 */
export function AutoGenerate() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createIdentity();
  }, []);

  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <Image
        src="/logo-transparent.png"
        alt=""
        width={96}
        height={96}
        priority
        className="h-24 w-24 animate-pulse drop-shadow-[0_18px_50px_rgba(232,138,118,0.28)]"
      />
      <p className="mt-8 text-xl font-medium text-warm-50">
        Meeting someone new&hellip;
      </p>
      <p className="mt-2 text-sm text-warm-300">This takes a few seconds.</p>
    </div>
  );
}
