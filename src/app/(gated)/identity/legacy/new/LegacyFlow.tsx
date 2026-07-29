"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LegacyCategory,
  LegacyQuestion,
} from "@/lib/legacy/questions";
import type { LegacySubject } from "@/lib/legacy/synthesize";
import { OTHER_IDENTITY_CREATE_PRICE_LABEL } from "@/lib/pricing";
import {
  completeLegacyIdentity,
  saveLegacyDraft,
  uploadLegacyPhoto,
} from "./actions";

/**
 * The 40-question legacy flow.
 *
 * Step 0 is "who is this for" (name, relationship, era, heritage) — collected
 * before any questions so Claude has the frame. Steps 1..40 are one question
 * per screen: category chip up top, the question big, a huge textarea, and a
 * coral→teal progress bar.
 *
 * Autosave: every edit schedules a debounced draft save (1.2s); every
 * navigation flushes immediately. The user can close the tab mid-sentence
 * and lose at most a second of typing.
 */

type Props = {
  // The bank arrives as props from the auth-gated server page — never
  // import @/lib/legacy/questions here (it's server-only content;
  // a client import would ship it in a public JS chunk).
  questions: LegacyQuestion[];
  categoryLabels: Record<LegacyCategory, string>;
  initialSubject: LegacySubject;
  initialAnswers: Record<string, string>;
  initialStep: number;
  serverError: string | null;
  // Stripe round-trip signals for the other-mode mint gate ($5 at
  // Finish). Both are COSMETIC — the server action re-checks the paid
  // credit on every Finish, so a hand-typed ?paid=1 buys nothing.
  paid: boolean;
  cancelled: boolean;
};

const AUTOSAVE_MS = 1200;

export function LegacyFlow({
  questions,
  categoryLabels,
  initialSubject,
  initialAnswers,
  initialStep,
  serverError,
  paid,
  cancelled,
}: Props) {
  const questionCount = questions.length;
  const [subject, setSubject] = useState<LegacySubject>(initialSubject);
  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [step, setStep] = useState(() =>
    Math.max(0, Math.min(questionCount, initialStep)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(true);
  // Fable audit: void save().then() with no .catch left the chip
  // stuck on "Saving…" forever if the write threw. Track failures
  // and surface a retry affordance next to the progress row + guard
  // navigation with beforeunload while dirty.
  const [saveError, setSaveError] = useState(false);

  // Latest state in a ref so the debounced save always writes fresh data.
  const latest = useRef({ subject, answers, step });
  useEffect(() => {
    latest.current = { subject, answers, step };
  }, [subject, answers, step]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback((stepOverride?: number) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const { subject, answers, step } = latest.current;
    saveLegacyDraft({
      subject,
      answers,
      currentStep: stepOverride ?? step,
    })
      .then(() => {
        setSaved(true);
        setSaveError(false);
      })
      .catch((err) => {
        console.error("[legacy] autosave failed:", err);
        setSaved(false);
        setSaveError(true);
      });
  }, []);

  const scheduleSave = useCallback(() => {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushSave(), AUTOSAVE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // beforeunload guard: warn on tab close if there's dirty unsaved
  // state (a pending debounced write or a prior save failure). Only
  // engages when there's something to lose.
  useEffect(() => {
    if (saved && !saveError) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saved, saveError]);

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(questionCount, next));
    setStep(clamped);
    flushSave(clamped);
    window.scrollTo({ top: 0 });
  }

  const [stuckError, setStuckError] = useState<string | null>(null);

  async function finish() {
    setSubmitting(true);
    setStuckError(null);
    flushSave();
    // Client-side watchdog: if the server action hasn't redirected in
    // ~5 minutes (matches page.tsx maxDuration=300), surface a retry
    // affordance instead of leaving the user on the WeavingScreen
    // forever. The action itself is idempotent-ish (fingerprint
    // uniqueness catches double-submits), so a retry is safe.
    const watchdog = window.setTimeout(() => {
      setSubmitting(false);
      setStuckError(
        "The weaving is taking longer than expected. Your answers are saved -- try Finish again.",
      );
    }, 305_000);
    try {
      // Success = server redirects, this component unmounts, watchdog
      // never fires. Failure = redirectWithError bounces back to this
      // page with ?error= (serverError prop repopulates on remount).
      await completeLegacyIdentity({
        subject: latest.current.subject,
        answers: latest.current.answers,
      });
    } finally {
      window.clearTimeout(watchdog);
    }
  }

  const answeredCount = Object.values(answers).filter(
    (a) => a.trim().length > 0,
  ).length;

  // The $5 mint gate applies to OTHER-mode only (self-mode stays
  // free). Drives the Finish CTA copy: price cue when unpaid, the
  // "You're paid" CTA after the Stripe round-trip. Cosmetic — the
  // server re-checks the credit either way.
  const isOtherMode = (subject.mode ?? "other") === "other";

  if (submitting) {
    return <WeavingScreen name={subject.name} />;
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-10">
      <div className="flex w-full max-w-xl flex-1 flex-col">
        {serverError ? (
          <div className="mb-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong ring-1 ring-coral/25">
            {serverError}
          </div>
        ) : null}
        {stuckError ? (
          <div className="mb-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong ring-1 ring-coral/25">
            {stuckError}
          </div>
        ) : null}
        {cancelled ? (
          <div className="mb-6 rounded-2xl bg-ink-soft px-4 py-3 text-sm font-medium text-warm-200 ring-1 ring-warm-700/60">
            Payment cancelled &mdash; your answers are saved. Click
            Finish when you&rsquo;re ready to pay.
          </div>
        ) : null}
        {paid && isOtherMode ? (
          <div className="mb-6 rounded-2xl bg-teal/10 px-4 py-3 text-sm font-medium text-teal-strong ring-1 ring-teal/25">
            Payment received &mdash; one click left. Hit the finish
            button whenever you&rsquo;re ready.
          </div>
        ) : null}

        {step === 0 ? (
          <SubjectScreen
            subject={subject}
            onChange={(next) => {
              setSubject(next);
              scheduleSave();
            }}
            onNext={() => goTo(1)}
          />
        ) : (
          <QuestionScreen
            questions={questions}
            categoryLabels={categoryLabels}
            step={step}
            answer={answers[questions[step - 1].id] ?? ""}
            onChange={(value) => {
              const id = questions[step - 1].id;
              setAnswers((prev) => ({ ...prev, [id]: value }));
              scheduleSave();
            }}
            onPrev={() => goTo(step - 1)}
            onNext={() => goTo(step + 1)}
            onFinish={finish}
            answeredCount={answeredCount}
            saved={saved}
            saveError={saveError}
            onRetrySave={() => flushSave()}
            paid={paid}
            isOtherMode={isOtherMode}
          />
        )}
      </div>
    </main>
  );
}

// ─── Step 0: who is this for ────────────────────────────────────────────────

function SubjectScreen({
  subject,
  onChange,
  onNext,
}: {
  subject: LegacySubject;
  onChange: (s: LegacySubject) => void;
  onNext: () => void;
}) {
  // Wilson's rule: photo BEFORE questions. The face travels with the
  // inherit code — whoever redeems sees the same person you're about
  // to write down. Name AND photo both required to advance.
  const canContinue =
    subject.name.trim().length > 0 && !!subject.photoUrl;
  const mode: "self" | "other" = subject.mode ?? "other";
  const isSelf = mode === "self";
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm font-semibold uppercase tracking-wider">
        <span className="text-gradient-cta">
          {isSelf ? "About you" : "About them"}
        </span>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-warm-50">
        {isSelf ? "A few basics, first." : "A few basics about them, first."}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-warm-300">
        Forty warm questions come after &mdash; everything saves as you
        go, so you can stop and pick up anytime. Pick the wrong path?{" "}
        <Link
          href="/identity/create"
          className="text-warm-100 underline underline-offset-2 hover:text-coral"
        >
          Go back to the picker
        </Link>
        .
      </p>

      <PhotoPicker
        photoUrl={subject.photoUrl ?? null}
        mode={mode}
        onChange={(photoUrl) =>
          onChange({ ...subject, photoUrl: photoUrl ?? undefined })
        }
      />

      <div className="mt-6 flex flex-col gap-5">
        <Field
          label={isSelf ? "Your name" : "Their name"}
          value={subject.name}
          placeholder={isSelf ? "Wilson · Rosa" : "Grandpa Joe · Rosa"}
          onChange={(name) => onChange({ ...subject, name })}
        />
        {isSelf ? null : (
          <Field
            label="What they are to you"
            value={subject.relationship}
            placeholder="My mother · Our grandfather · My best friend"
            onChange={(relationship) =>
              onChange({ ...subject, relationship })
            }
          />
        )}
        <Field
          label={isSelf ? "When and where you're from" : "When and where they're from"}
          value={subject.era}
          placeholder={
            isSelf
              ? "Born 1990, raised in Miami"
              : "Born 1952, raised in the Bronx"
          }
          onChange={(era) => onChange({ ...subject, era })}
        />
        <Field
          label={isSelf ? "Your roots" : "Their roots"}
          value={subject.heritage}
          placeholder="Dominican · Catholic household · first-generation"
          onChange={(heritage) => onChange({ ...subject, heritage })}
        />
      </div>

      {/* One-line reminder about texting voice. The full callout used
          to live here but it's redundant with the persistent tip on
          every QuestionScreen; keeping just the single sentence here
          so first-timers get the frame before they hit the questions. */}
      <p className="mt-6 text-xs leading-relaxed text-warm-400">
        {isSelf
          ? "Tip: type how you actually text — lowercase, missing periods, all of it. Don't clean it up."
          : "Tip: type how they actually text — lowercase, missing periods, all of it. Don't clean it up."}
      </p>

      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue}
        className="bg-gradient-cta mt-10 flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5),_0_4px_12px_rgba(126,196,196,0.18)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start
      </button>

      <Link
        href="/identity/create"
        className="mt-5 text-center text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
      >
        Back
      </Link>
    </div>
  );
}

/**
 * Segmented control for "who is this for?" — the first decision on
 * Step 0. Renders as two side-by-side pills with the active side in
 * the coral+teal gradient. Keyboard accessible via arrow keys (native
 * radio behavior) and screen-readers via role="radiogroup".
 */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: "self" | "other";
  onChange: (next: "self" | "other") => void;
}) {
  const options: Array<{ value: "self" | "other"; label: string; sub: string }> = [
    { value: "self", label: "I'm doing this for myself", sub: "Answered in your own voice." },
    { value: "other", label: "For someone I love", sub: "Family recording who they are." },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Who are you making this identity for?"
      className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? "bg-gradient-cta rounded-2xl px-4 py-3 text-left text-white shadow-[0_10px_24px_-8px_rgba(232,138,118,0.35)]"
                : "rounded-2xl bg-ink-soft px-4 py-3 text-left text-warm-100 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-700/25"
            }
          >
            <p className="text-sm font-semibold">{opt.label}</p>
            <p
              className={
                active
                  ? "mt-0.5 text-xs text-white/85"
                  : "mt-0.5 text-xs text-warm-400"
              }
            >
              {opt.sub}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function PhotoPicker({
  photoUrl,
  onChange,
  mode,
}: {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
  mode: "self" | "other";
}) {
  const isSelf = mode === "self";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErr(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const result = await uploadLegacyPhoto(fd);
      if (result.ok) {
        onChange(result.url);
      } else {
        setErr(result.error);
      }
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-ink-soft/60 p-5 ring-1 ring-warm-700/60">
      <p className="text-center text-sm font-semibold text-warm-100">
        {isSelf ? "Your photo" : "Their photo"}
      </p>
      <p className="text-center text-xs leading-relaxed text-warm-400">
        {isSelf
          ? "Whoever inherits your code will see this face when they open the chat. Pick the one that feels most like you."
          : "Whoever inherits the code will see this face when they open the chat. Pick the one that feels most like them."}
      </p>
      <div className="relative">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="h-32 w-32 rounded-full object-cover shadow-[0_12px_28px_-6px_rgba(232,138,118,0.4)] ring-2 ring-coral/30"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-32 w-32 items-center justify-center rounded-full bg-warm-700/40 text-warm-400 ring-2 ring-warm-700/60"
          >
            <PhotoPlaceholderIcon />
          </span>
        )}
        {pending ? (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center rounded-full bg-warm-50/40 backdrop-blur-sm"
          >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="bg-gradient-cta rounded-full px-5 py-2 text-sm font-semibold text-white shadow-[0_6px_16px_-4px_rgba(232,138,118,0.4)] transition-all hover:-translate-y-px active:scale-95 disabled:opacity-60"
      >
        {pending ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={onPick}
        className="sr-only"
        aria-label="Choose their photo"
      />
      {err ? (
        <p role="alert" className="text-center text-xs text-coral-strong">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function PhotoPlaceholderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="36"
      height="36"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M17 8.5h.01" />
    </svg>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-warm-100">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        className="h-13 rounded-2xl bg-ink-soft px-4 py-3.5 text-base text-warm-50 shadow-[0_4px_12px_-4px_rgba(28,28,26,0.08)] ring-1 ring-warm-700 outline-none transition-shadow placeholder:text-warm-500 focus:ring-2 focus:ring-coral/50"
      />
    </label>
  );
}

// ─── Steps 1..40: one question per screen ───────────────────────────────────

// Server-side MIN_ANSWERS gate (src/app/(gated)/identity/legacy/new/
// actions.ts) — a partial archive is completable once the count is
// this high. Keep in sync with the server constant. Fable audit:
// without this the user had to click "Skip" 18 times to reach the
// "Bring them together" button on Q40 if the person they were
// recording died mid-flow.
const MIN_ANSWERS_TO_FINISH = 20;

function QuestionScreen({
  questions,
  categoryLabels,
  step,
  answer,
  onChange,
  onPrev,
  onNext,
  onFinish,
  answeredCount,
  saved,
  saveError,
  onRetrySave,
  paid,
  isOtherMode,
}: {
  questions: LegacyQuestion[];
  categoryLabels: Record<LegacyCategory, string>;
  step: number;
  answer: string;
  onChange: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  answeredCount: number;
  saved: boolean;
  saveError: boolean;
  onRetrySave: () => void;
  paid: boolean;
  isOtherMode: boolean;
}) {
  const question = questions[step - 1];
  const isLast = step === questions.length;
  const canFinishEarly = !isLast && answeredCount >= MIN_ANSWERS_TO_FINISH;
  const progress = (step / questions.length) * 100;

  // Other-mode finish copy carries the $5 gate: a price cue before
  // payment, the paid CTA after the Stripe round-trip (Wilson's
  // option B — transparent, one extra click, no auto-magic). Self
  // mode keeps the original label; the server enforces either way.
  const finishLabel = !isOtherMode
    ? "Bring them together"
    : paid
      ? "You're paid — finish it"
      : `Bring them together · ${OTHER_IDENTITY_CREATE_PRICE_LABEL}`;

  // Single-voice question rendering (2026-07-29): questions.ts ships
  // sibling self/other phrasings, and the synthesizer already assumes
  // self-mode answerers SAW the second-person variant (synthesize.ts
  // `shownPrompt = isSelf ? q.promptSelf ?? q.prompt : q.prompt`) —
  // but this screen rendered the third-person prompt for everyone.
  // Mirror the synthesizer's selection so the mobile port and the web
  // show the same words the model is told the user read.
  const shownPrompt = !isOtherMode
    ? question.promptSelf ?? question.prompt
    : question.prompt;
  const shownPlaceholder = !isOtherMode
    ? question.placeholderSelf ?? question.placeholder
    : question.placeholder;

  return (
    <div className="flex flex-1 flex-col">
      {/* Progress: label + coral→teal bar */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-warm-300">
          Question {step} of {questions.length} ·{" "}
          {categoryLabels[question.category]}
        </p>
        {saveError ? (
          <button
            type="button"
            onClick={onRetrySave}
            className="text-xs font-medium text-coral-strong underline underline-offset-2 hover:text-coral"
          >
            Save failed — retry
          </button>
        ) : (
          <p
            className={`text-xs font-medium transition-opacity ${saved ? "text-warm-400 opacity-100" : "text-warm-500 opacity-70"}`}
          >
            {saved ? "Saved" : "Saving…"}
          </p>
        )}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-warm-700">
        <div
          className="bg-gradient-cta h-full rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-10 text-sm font-semibold uppercase tracking-wider">
        <span className="text-gradient-cta">
          {categoryLabels[question.category]}
        </span>
      </p>
      <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-warm-50 sm:text-3xl">
        {shownPrompt}
      </h1>
      {question.estimateMinutes && question.estimateMinutes >= 4 ? (
        <p className="mt-2 text-sm text-warm-400">
          One of the big ones — worth {question.estimateMinutes} minutes.
        </p>
      ) : null}

      <textarea
        key={question.id}
        value={answer}
        onChange={(e) => onChange(e.target.value)}
        placeholder={shownPlaceholder}
        maxLength={4000}
        rows={question.category === "essay" ? 12 : 8}
        autoFocus
        className="mt-8 w-full flex-1 resize-none rounded-3xl bg-ink-soft p-5 text-lg leading-relaxed text-warm-50 shadow-[0_10px_28px_-12px_rgba(28,28,26,0.12)] ring-1 ring-warm-700 outline-none transition-shadow placeholder:text-warm-500 focus:ring-2 focus:ring-coral/50"
      />

      {/* Small persistent reminder — the intro-page note is easy to
          forget by question 12. Keep the "type how they text" nudge
          in reach. */}
      <p className="mt-3 text-xs leading-relaxed text-warm-400">
        Type it the way they&rsquo;d text it — lowercase, no periods, run-on,
        whatever it is. Voice dictation smooths that out; skip it.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-13 items-center justify-center rounded-full px-6 text-base font-medium text-warm-300 ring-1 ring-warm-700 transition-colors hover:text-warm-100 hover:ring-warm-500"
        >
          Back
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onFinish}
            className="bg-gradient-cta flex h-13 flex-1 items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90"
          >
            {finishLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="bg-gradient-cta flex h-13 flex-1 items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90"
          >
            {answer.trim() ? "Next" : "Skip for now"}
          </button>
        )}
      </div>

      {/* Finish-early affordance for partial archives. The server
          accepts anything ≥ MIN_ANSWERS (20) — before this, family
          members recording someone who passed mid-flow had to click
          "Skip for now" through every remaining question just to
          reach the "Bring them together" button on Q40. */}
      {canFinishEarly ? (
        <button
          type="button"
          onClick={onFinish}
          className="mt-4 flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-warm-300 ring-1 ring-warm-700 transition-colors hover:text-warm-100 hover:ring-warm-500"
        >
          {!isOtherMode
            ? `Finish now with ${answeredCount} answers`
            : paid
              ? `You're paid — finish now with ${answeredCount} answers`
              : `Finish now with ${answeredCount} answers · ${OTHER_IDENTITY_CREATE_PRICE_LABEL}`}
        </button>
      ) : null}

      {isLast ? (
        <p className="mt-4 text-center text-sm text-warm-400">
          {answeredCount} of {questions.length} answered. You can go back
          and add more anytime before finishing.
        </p>
      ) : null}
    </div>
  );
}

// ─── Weaving overlay ────────────────────────────────────────────────────────

function WeavingScreen({ name }: { name: string }) {
  // Smooth trickle percentage. The server action is opaque (Claude
  // synthesis inside a Next server action -- no streaming signal we
  // can subscribe to), so we simulate: fast at first, slower as we
  // approach 92, then hold. The redirect unmounts this screen the
  // instant synthesis completes, so users almost always see the jump
  // 92 -> next-page rather than 92 sitting forever. Time-based
  // exponential curve (not a fixed step) keeps the number smooth if
  // the tab is throttled or the frame rate stutters.
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const CEILING = 92;
    const TAU_MS = 12_000; // shape constant; ~63% at 12s, ~92% at 30s
    const id = window.setInterval(() => {
      const t = performance.now() - start;
      const next = CEILING * (1 - Math.exp(-t / TAU_MS));
      setPct((prev) => (next > prev ? next : prev));
    }, 200);
    return () => window.clearInterval(id);
  }, []);
  const displayPct = Math.floor(pct);
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="hero-orb hero-orb-drift flex flex-col items-center pt-4 text-center">
        <Image
          src="/logo-transparent.png"
          alt=""
          width={96}
          height={96}
          priority
          className="h-24 w-24 animate-pulse drop-shadow-[0_18px_50px_rgba(232,138,118,0.28)]"
        />
        <p className="mt-8 text-xl font-medium text-warm-50">
          {`Weaving ${name.trim() || "them"} together`}
          <span aria-hidden>&hellip;</span>
        </p>
        <div
          className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-warm-700/40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayPct}
          aria-label="Weaving progress"
        >
          <div
            className="bg-gradient-cta h-full rounded-full transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs tabular-nums text-warm-300">
          {displayPct}%
        </p>
        <p className="mt-3 text-sm text-warm-300">
          Every answer becomes part of who they are. This takes a minute.
        </p>
      </div>
    </main>
  );
}
