"use client";

import { useCallback, useRef, useState } from "react";
import MicButton from "./MicButton";

/**
 * Bottom composer: auto-growing textarea (caps at ~4 lines, then
 * scrolls), mic button that dictates INTO the textarea (editable
 * before send), and a gradient send button.
 *
 * Enter sends; Shift+Enter inserts a newline.
 */
export default function ChatInput({
  name,
  disabled,
  onSend,
}: {
  name: string;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Text present when a dictation session starts; the live transcript
  // is appended to this so typing + speaking compose cleanly.
  const micBaseRef = useRef("");

  const autogrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`; // ~4 lines
  }, []);

  const setAndGrow = useCallback(
    (next: string) => {
      setValue(next);
      requestAnimationFrame(autogrow);
    },
    [autogrow],
  );

  const send = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    setAndGrow("");
    onSend(text);
  }, [disabled, onSend, setAndGrow, value]);

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-1 items-end rounded-3xl bg-ink-soft ring-1 ring-warm-700 focus-within:ring-teal">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setAndGrow(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={`Message ${name}`}
          aria-label={`Message ${name}`}
          className="max-h-28 w-full resize-none bg-transparent px-4 py-2.5 text-[15px] text-warm-100 placeholder:text-warm-400 focus:outline-none"
        />
        <MicButton
          onSessionStart={() => {
            micBaseRef.current = value.trim()
              ? `${value.replace(/\s+$/, "")} `
              : "";
          }}
          onTranscript={(sessionText) => {
            setAndGrow(micBaseRef.current + sessionText);
          }}
        />
      </div>
      <button
        type="button"
        onClick={send}
        disabled={disabled || !value.trim()}
        aria-label="Send"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-cta text-white transition-opacity disabled:opacity-40"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M10 16V4m0 0 -5 5m5-5 5 5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
