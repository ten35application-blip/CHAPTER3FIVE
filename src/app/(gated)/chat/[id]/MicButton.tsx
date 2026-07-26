"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

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

/** Imperative surface exposed to the parent (ChatInput) via ref so a
 *  send-tap can force-stop an in-progress dictation. */
export type MicButtonHandle = {
  stop: () => void;
};

const MicButton = forwardRef<
  MicButtonHandle,
  {
    onSessionStart: () => void;
    onTranscript: (sessionText: string) => void;
  }
>(function MicButton({ onSessionStart, onTranscript }, ref) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Latched flag: once stop is requested, ignore any late onresult
  // events the recognition may still deliver before it truly winds
  // down. iOS Safari is especially prone to trailing results.
  const cancelledRef = useRef(false);

  // Detect in an effect so SSR + hydration agree on the initial render.
  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
    return () => {
      cancelledRef.current = true;
      recognitionRef.current?.abort();
    };
  }, []);

  const stop = () => {
    // abort(), not stop(). stop() is a graceful "please wind down after
    // the current utterance"; iOS Safari can hold that request open for
    // seconds and keep firing onresult in the meantime. abort() kills
    // the session immediately and guarantees the mic stops. Latch
    // cancelled first so any final in-flight result is dropped, then
    // detach handlers on the outgoing instance — rapid stop→start
    // otherwise lets the old rec's trailing onresult fire under the
    // new session's cancelledRef=false and pollute the transcript.
    cancelledRef.current = true;
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      rec.abort();
    }
    recognitionRef.current = null;
    setListening(false);
  };

  useImperativeHandle(ref, () => ({ stop }));

  if (!supported) return null;

  const start = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    cancelledRef.current = false;
    rec.onresult = (event) => {
      if (cancelledRef.current) return;
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
});

export default MicButton;
