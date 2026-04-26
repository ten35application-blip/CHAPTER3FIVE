"use client";

import { useRef, useState } from "react";

type Props = {
  url: string;
  durationSeconds: number;
  language: "en" | "es";
};

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SharedAudioPlayer({ url, durationSeconds, language }: Props) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-warm-300/30 bg-warm-700/30 px-4 py-2">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 text-sm text-warm-50 hover:text-warm-100 transition-colors font-serif italic"
      >
        {playing ? "⏸" : "▶"}{" "}
        {language === "es" ? "Su voz" : "Their voice"}
      </button>
      <span className="text-xs text-warm-300 tabular-nums">
        {fmt(durationSeconds)}
      </span>
      <audio
        ref={ref}
        src={url}
        preload="none"
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
