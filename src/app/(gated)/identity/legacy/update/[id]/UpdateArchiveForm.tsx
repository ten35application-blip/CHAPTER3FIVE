"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  category: string;
  prompt: string;
  promptSelf?: string;
};

/**
 * The touch-up surface: photo at the top, every question below with
 * whatever was written, blanks inviting an answer.
 *
 * Add and correct, never delete — an answer can be changed but an
 * emptied one is simply not sent, matching the server's refusal. The
 * photo goes through /api/legacy/photo and we keep the returned URL
 * ONLY if the endpoint hands one back: that endpoint was dead in
 * production until 2026-08-22 and the walk stored a URL regardless,
 * which is how an archive ended up rendering a black square.
 */
export function UpdateArchiveForm({
  oracleId,
  photoUrl,
  questions,
  categoryLabels,
  initialAnswers,
}: {
  oracleId: string;
  photoUrl: string | null;
  questions: Question[];
  categoryLabels: Record<string, string>;
  initialAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [photo, setPhoto] = useState<string | null>(photoUrl);
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const changed = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, text] of Object.entries(answers)) {
      const before = (initialAnswers[id] ?? "").trim();
      const now = (text ?? "").trim();
      if (now && now !== before) out[id] = now;
    }
    return out;
  }, [answers, initialAnswers]);

  const dirty = Boolean(newPhoto) || Object.keys(changed).length > 0;
  const answeredCount = Object.values(answers).filter((a) => a?.trim()).length;

  const onPick = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/legacy/photo", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Couldn't save that photo. Try another one.");
        return;
      }
      setNewPhoto(body.url);
      setPhoto(body.url);
    } catch {
      setError("Couldn't save that photo. Try another one.");
    } finally {
      setUploading(false);
    }
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/legacy/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oracle_id: oracleId,
          ...(newPhoto ? { photo_url: newPhoto } : {}),
          answers: changed,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        copies_updated?: number;
      };
      if (!res.ok) {
        setError(body.error ?? "Couldn't save. Try again in a moment.");
        return;
      }
      const shared = body.copies_updated ?? 0;
      setDone(
        shared > 0
          ? `Saved. ${shared === 1 ? "The person who" : `The ${shared} people who`} already have your code will see it too.`
          : "Saved.",
      );
      setNewPhoto(null);
      router.refresh();
    } catch {
      setError("Couldn't save. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }, [changed, newPhoto, oracleId, router]);

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-warm-50">
            Your archive
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-warm-300">
            {`Add anything you skipped, fix anything that came out wrong, or change your photo. Nothing gets removed — ${answeredCount} of ${questions.length} answered.`}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="bg-gradient-cta shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-px disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {done ? (
        <p
          role="status"
          className="mt-4 rounded-xl bg-teal/10 px-4 py-3 text-sm font-medium text-teal-strong"
        >
          {done}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong"
        >
          {error}
        </p>
      ) : null}

      {/* Photo */}
      <section className="mt-6 flex items-center gap-4 rounded-[18px] bg-ink-soft p-4 ring-1 ring-warm-700">
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warm-700 text-xl text-warm-400">
            ·
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-warm-100">
            {photo ? "Your photo" : "No photo yet"}
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="mt-0.5 text-[13px] font-bold text-teal-strong underline underline-offset-2 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : photo ? "Change photo" : "Add a photo"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPick(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {/* Questions */}
      <div className="mt-4 flex flex-col gap-3">
        {questions.map((q, i) => {
          const value = answers[q.id] ?? "";
          return (
            <section
              key={q.id}
              className="rounded-[18px] bg-ink-soft p-4 ring-1 ring-warm-700"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-warm-400">
                {`${i + 1}. ${categoryLabels[q.category] ?? ""}`}
              </p>
              <label
                htmlFor={`q-${q.id}`}
                className="mt-1 block text-[15px] font-semibold text-warm-100"
              >
                {q.promptSelf ?? q.prompt}
              </label>
              <textarea
                id={`q-${q.id}`}
                value={value}
                rows={value.trim() ? 4 : 2}
                placeholder="Take your time."
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                className="mt-2 w-full resize-y rounded-xl bg-ink px-3 py-2.5 text-[15px] leading-relaxed text-warm-50 ring-1 ring-warm-700 placeholder:text-warm-500 focus:outline-none focus:ring-teal"
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
