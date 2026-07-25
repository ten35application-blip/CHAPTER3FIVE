"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LEGACY_CATEGORY_LABELS,
  LEGACY_QUESTIONS,
  LEGACY_QUESTION_COUNT,
} from "@/lib/legacy/questions";
import type { LegacySubject } from "@/lib/legacy/synthesize";
import { completeLegacyIdentity, saveLegacyDraft } from "./actions";

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
  initialSubject: LegacySubject;
  initialAnswers: Record<string, string>;
  initialStep: number;
  serverError: string | null;
};

const AUTOSAVE_MS = 1200;

export function LegacyFlow({
  initialSubject,
  initialAnswers,
  initialStep,
  serverError,
}: Props) {
  const [subject, setSubject] = useState<LegacySubject>(initialSubject);
  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [step, setStep] = useState(() =>
    Math.max(0, Math.min(LEGACY_QUESTION_COUNT, initialStep)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(true);

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
    void saveLegacyDraft({
      subject,
      answers,
      currentStep: stepOverride ?? step,
    }).then(() => setSaved(true));
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

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(LEGACY_QUESTION_COUNT, next));
    setStep(clamped);
    flushSave(clamped);
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    setSubmitting(true);
    flushSave();
    // The action redirects on success; on failure it redirects back here
    // with ?error= and the draft intact.
    await completeLegacyIdentity({
      subject: latest.current.subject,
      answers: latest.current.answers,
    });
  }

  const answeredCount = Object.values(answers).filter(
    (a) => a.trim().length > 0,
  ).length;

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
            step={step}
            answer={answers[LEGACY_QUESTIONS[step - 1].id] ?? ""}
            onChange={(value) => {
              const id = LEGACY_QUESTIONS[step - 1].id;
              setAnswers((prev) => ({ ...prev, [id]: value }));
              scheduleSave();
            }}
            onPrev={() => goTo(step - 1)}
            onNext={() => goTo(step + 1)}
            onFinish={finish}
            answeredCount={answeredCount}
            saved={saved}
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
  const canContinue = subject.name.trim().length > 0;
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm font-semibold uppercase tracking-wider">
        <span className="text-gradient-cta">Someone to keep</span>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-warm-50">
        Who are we keeping?
      </h1>
      <p className="mt-3 text-base leading-relaxed text-warm-300">
        Forty questions, answered by you — or by the whole family around one
        table. If this is about you, answer in your own voice. Everything
        saves as you go, so take days if you need them.
      </p>

      {/* Texting-style note — the single most important guidance for
          fidelity. Their real texting rhythm (lowercase, no periods,
          run-on sentences, whatever) IS part of them. Dictation cleans
          it up into generic prose and washes that out. */}
      <div className="mt-5 rounded-2xl bg-coral/8 p-4 ring-1 ring-coral/20">
        <p className="text-sm font-semibold text-warm-50">
          Type how they actually text.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-warm-300">
          The all-lowercase, the missing periods, the ALL CAPS when they&rsquo;re
          hyped, the way they always start with &ldquo;so&rdquo; — that&rsquo;s
          them. Don&rsquo;t fix it into clean prose. Don&rsquo;t dictate through
          a mic; it strips the voice out. Write it the way it would land in a
          real text from them.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-5">
        <Field
          label="Their name, the way the family says it"
          value={subject.name}
          placeholder="Grandpa Joe · Rosa · Me"
          onChange={(name) => onChange({ ...subject, name })}
        />
        <Field
          label="Who are they to you?"
          value={subject.relationship}
          placeholder="My mother · Our grandfather · Myself"
          onChange={(relationship) => onChange({ ...subject, relationship })}
        />
        <Field
          label="Their era"
          value={subject.era}
          placeholder="Born 1952, raised in the Bronx"
          onChange={(era) => onChange({ ...subject, era })}
        />
        <Field
          label="Their roots"
          value={subject.heritage}
          placeholder="Dominican · Catholic household · first-generation"
          onChange={(heritage) => onChange({ ...subject, heritage })}
        />
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue}
        className="bg-gradient-cta mt-10 flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5),_0_4px_12px_rgba(126,196,196,0.18)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Begin the questions
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

function QuestionScreen({
  step,
  answer,
  onChange,
  onPrev,
  onNext,
  onFinish,
  answeredCount,
  saved,
}: {
  step: number;
  answer: string;
  onChange: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  answeredCount: number;
  saved: boolean;
}) {
  const question = LEGACY_QUESTIONS[step - 1];
  const isLast = step === LEGACY_QUESTION_COUNT;
  const progress = (step / LEGACY_QUESTION_COUNT) * 100;

  return (
    <div className="flex flex-1 flex-col">
      {/* Progress: label + coral→teal bar */}
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-warm-300">
          Question {step} of {LEGACY_QUESTION_COUNT} ·{" "}
          {LEGACY_CATEGORY_LABELS[question.category]}
        </p>
        <p
          className={`text-xs font-medium transition-opacity ${saved ? "text-warm-400 opacity-100" : "text-warm-500 opacity-70"}`}
        >
          {saved ? "Saved" : "Saving…"}
        </p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-warm-700">
        <div
          className="bg-gradient-cta h-full rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-10 text-sm font-semibold uppercase tracking-wider">
        <span className="text-gradient-cta">
          {LEGACY_CATEGORY_LABELS[question.category]}
        </span>
      </p>
      <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-warm-50 sm:text-3xl">
        {question.prompt}
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
        placeholder={question.placeholder}
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
            Bring them together
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

      {isLast ? (
        <p className="mt-4 text-center text-sm text-warm-400">
          {answeredCount} of {LEGACY_QUESTION_COUNT} answered. You can go back
          and add more anytime before finishing.
        </p>
      ) : null}
    </div>
  );
}

// ─── Weaving overlay ────────────────────────────────────────────────────────

function WeavingScreen({ name }: { name: string }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="hero-orb hero-orb-drift flex flex-col items-center pt-4 text-center">
        <Image
          src="/logo.png"
          alt=""
          width={96}
          height={96}
          priority
          className="h-24 w-24 animate-pulse drop-shadow-[0_18px_50px_rgba(232,138,118,0.28)]"
        />
        <p className="mt-8 text-xl font-medium text-warm-50">
          Weaving {name.trim() || "them"} together&hellip;
        </p>
        <p className="mt-2 text-sm text-warm-300">
          Every answer becomes part of who they are. This takes a minute.
        </p>
      </div>
    </main>
  );
}
