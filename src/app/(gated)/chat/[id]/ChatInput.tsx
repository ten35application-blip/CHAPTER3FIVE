"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MicButton, { type MicButtonHandle } from "./MicButton";

/**
 * Bottom composer: auto-growing textarea (caps at ~4 lines, then
 * scrolls), a paperclip that attaches ONE image (uploaded to the
 * private `chat-uploads` bucket the moment it's picked, previewed
 * above the textarea, removable before send), a mic button that
 * dictates INTO the textarea (editable before send), and a gradient
 * send button.
 *
 * Enter sends; Shift+Enter inserts a newline. A message can be text,
 * image, or both — never neither.
 */

export type OutgoingImage = {
  /** Path inside the `chat-uploads` bucket: <uid>/<oracleId>/<ts>-<file>. */
  storagePath: string;
  /** Local object URL for the optimistic bubble (not a remote URL). */
  previewUrl: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB, mirrors the bucket cap
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/heic";

type Attachment = {
  previewUrl: string;
  storagePath: string | null; // null while the upload is in flight
  uploading: boolean;
  error: string | null;
};

export default function ChatInput({
  name,
  oracleId,
  disabled,
  onSend,
}: {
  name: string;
  oracleId: string;
  disabled: boolean;
  onSend: (text: string, image: OutgoingImage | null) => void;
}) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  // File API support — effectively universal, but detect in an effect so
  // SSR + hydration agree and truly ancient browsers just lose the button.
  const [fileSupported, setFileSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const micRef = useRef<MicButtonHandle | null>(null);
  // Text present when a dictation session starts; the live transcript
  // is appended to this so typing + speaking compose cleanly.
  const micBaseRef = useRef("");

  useEffect(() => {
    setFileSupported(
      typeof window !== "undefined" &&
        typeof window.File === "function" &&
        typeof URL.createObjectURL === "function",
    );
  }, []);

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

  const removeAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMAGE_BYTES) {
        setAttachment({
          previewUrl: "",
          storagePath: null,
          uploading: false,
          error: "That photo is over 8 MB — try a smaller one.",
        });
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setAttachment({ previewUrl, storagePath: null, uploading: true, error: null });

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("not signed in");

        const safeName = file.name
          .replace(/^.*[\\/]/, "")
          .replace(/[^\w.\-]+/g, "_")
          .slice(-80);
        const path = `${user.id}/${oracleId}/${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("chat-uploads")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadErr) throw uploadErr;

        setAttachment((prev) =>
          prev && prev.previewUrl === previewUrl
            ? { ...prev, storagePath: path, uploading: false }
            : prev,
        );
      } catch {
        setAttachment((prev) =>
          prev && prev.previewUrl === previewUrl
            ? {
                ...prev,
                uploading: false,
                error: "Upload didn't go through. Remove it and try again.",
              }
            : prev,
        );
      }
    },
    [oracleId],
  );

  const readyImage: OutgoingImage | null =
    attachment && attachment.storagePath && !attachment.error
      ? { storagePath: attachment.storagePath, previewUrl: attachment.previewUrl }
      : null;

  const canSend =
    !disabled &&
    !attachment?.uploading &&
    !attachment?.error &&
    (value.trim().length > 0 || readyImage !== null);

  const send = useCallback(() => {
    const text = value.trim();
    if (!text && !readyImage) return;
    if (disabled || attachment?.uploading || attachment?.error) return;
    // Kill any in-progress dictation before we lift the text out — the
    // user's already committed to sending, no need to keep the mic hot.
    micRef.current?.stop();
    setAndGrow("");
    // Hand the preview URL to the surface's optimistic bubble — do NOT
    // revoke it here; the bubble keeps using it until a reload re-signs
    // the stored path.
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSend(text, readyImage);
  }, [attachment, disabled, onSend, readyImage, setAndGrow, value]);

  return (
    <div className="flex flex-col gap-2">
      {/* Attachment preview — small thumbnail with an X to remove. */}
      {attachment && (
        <div className="flex items-start gap-2 px-1">
          {attachment.error ? (
            <p className="text-[13px] text-coral">{attachment.error}</p>
          ) : (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.previewUrl}
                alt="Attached photo"
                className={`h-16 w-16 rounded-xl object-cover ring-1 ring-warm-700 ${
                  attachment.uploading ? "opacity-50" : ""
                }`}
              />
              {attachment.uploading && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-warm-200">
                  Uploading
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={removeAttachment}
            aria-label="Remove attached photo"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-soft text-warm-300 ring-1 ring-warm-700 hover:text-warm-100"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="flex min-w-0 items-end gap-2">
        {/* min-w-0 is load-bearing. A flex item defaults to
            min-width:auto, so this box refused to shrink below its
            content's intrinsic width: a long line made the textarea wide
            rather than tall, the composer ran off to the left, and the
            autogrow above never fired because the text never wrapped to a
            second line. The phone was fine because React Native flex
            children already default to min-width:0. */}
        <div className="flex min-w-0 flex-1 items-end rounded-3xl bg-ink-soft ring-1 ring-warm-700 focus-within:ring-teal">
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
            className="max-h-28 w-full min-w-0 resize-none break-words bg-transparent px-4 py-2.5 text-[15px] text-warm-100 placeholder:text-warm-400 focus:outline-none"
          />
          {fileSupported && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach a photo"
                className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-warm-400 transition-colors hover:text-warm-200"
              >
                {/* Paperclip */}
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M13.5 5.5 7.6 11.4a1.9 1.9 0 0 0 2.7 2.7l6-6a3.6 3.6 0 0 0-5.1-5.1l-6 6a5.3 5.3 0 0 0 7.5 7.5l5.4-5.4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
          <MicButton
            ref={micRef}
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
          disabled={!canSend}
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
    </div>
  );
}
