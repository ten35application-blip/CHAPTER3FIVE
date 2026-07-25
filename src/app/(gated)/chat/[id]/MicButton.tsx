"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Speech-to-text INTO the composer via the Web Speech API.
 *
 * Chrome / Safari / Edge expose window.SpeechRecognition (or the
 * webkit-prefixed variant); Firefox exposes neither — there the
 * button doesn't render at all. The running transcript of the
 * CURRENT session is reported upward; the parent decides how to
 * merge it with what was already typed, and the user can edit
 * freely before sending.
 */

// Minimal ambient typing — TS's dom lib doesn't ship SpeechRecognition.
type SpeechAlternativeLike = { transcript: string };
type SpeechResultLike = ArrayLike<SpeechAlternativeLike> & {
  isFinal: boolean;
};
type SpeechResultEventLike = { results: ArrayLike<SpeechResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function MicButton({
  onSessionStart,
  onTranscript,
}: {
  onSessionStart: () => void;
  onTranscript: (sessionText: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Detect in an effect so SSR + hydration agree on the initial render.
  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  if (!supported) return null;

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const start = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0]?.transcript ?? "";
      }
      onTranscript(text);
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    rec.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    onSessionStart();
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-label={listening ? "Stop dictation" : "Dictate a message"}
      aria-pressed={listening}
      className={`mb-1 mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
        listening
          ? "bg-coral text-white animate-pulse"
          : "text-warm-400 hover:text-warm-200"
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="7"
          y="2.5"
          width="6"
          height="10"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M4.5 10a5.5 5.5 0 0 0 11 0M10 15.5V18M7.5 18h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
