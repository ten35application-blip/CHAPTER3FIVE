"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setAnswerBody } from "@/app/answers/actions";

type Props = {
  oracleId: string;
  questionId: number;
  /** Existing audio URL if already recorded. */
  initialAudioUrl?: string | null;
  initialDurationSeconds?: number | null;
  language: "en" | "es";
};

const COPY = {
  en: {
    record: "Record voice",
    rerecord: "Re-record",
    stop: "Stop",
    play: "Play",
    pause: "Pause",
    delete: "Delete recording",
    confirmDelete: "Delete this recording?",
    uploading: "Saving…",
    transcribing: "Transcribing your voice…",
    transcribed: "Transcribed:",
    useAsAnswer: "Use as my answer",
    using: "Using…",
    used: "Used as your answer",
    permissionDenied: "Microphone permission required.",
    error: "Something went wrong recording.",
    yourVoice: "Your voice",
  },
  es: {
    record: "Grabar voz",
    rerecord: "Volver a grabar",
    stop: "Detener",
    play: "Reproducir",
    pause: "Pausar",
    delete: "Borrar grabación",
    confirmDelete: "¿Borrar esta grabación?",
    uploading: "Guardando…",
    transcribing: "Transcribiendo tu voz…",
    transcribed: "Transcrito:",
    useAsAnswer: "Usar como mi respuesta",
    using: "Usando…",
    used: "Guardado como tu respuesta",
    permissionDenied: "Se necesita permiso del micrófono.",
    error: "Algo salió mal grabando.",
    yourVoice: "Tu voz",
  },
};

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceAnswer({
  oracleId,
  questionId,
  initialAudioUrl = null,
  initialDurationSeconds = null,
  language,
}: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [state, setState] = useState<
    "idle" | "recording" | "uploading" | "ready" | "playing"
  >(initialAudioUrl ? "ready" : "idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl);
  const [duration, setDuration] = useState<number>(initialDurationSeconds ?? 0);
  const [elapsed, setElapsed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [usingTranscript, setUsingTranscript] = useState(false);
  const [usedTranscript, setUsedTranscript] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup tick interval on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        const elapsedMs = Date.now() - startedAtRef.current;
        const seconds = Math.round(elapsedMs / 1000);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        await handleUpload(blob, seconds);
      };

      recorder.start();
      setState("recording");
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      console.error("getUserMedia failed:", err);
      setError(t.permissionDenied);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function handleUpload(blob: Blob, seconds: number) {
    setState("uploading");
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      const ext = blob.type.includes("mp4") ? "m4a" : "webm";
      const path = `${userId}/${oracleId}/${questionId}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("archive-audio")
        .upload(path, blob, {
          contentType: blob.type,
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      // Long-lived signed URL so it works for playback in the chat
      // history and the answers page across sessions.
      const { data: signed } = await supabase.storage
        .from("archive-audio")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1y
      const url = signed?.signedUrl ?? null;

      // Persist on the answers row. Touch ONLY the audio columns when
      // a text answer already exists — never clobber the user's typed
      // text. If no row exists yet, insert with an empty body so the
      // user can add text later (the schema allows empty body).
      const { data: existing } = await supabase
        .from("answers")
        .select("id")
        .eq("oracle_id", oracleId)
        .eq("question_id", questionId)
        .eq("variant", 1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("answers")
          .update({
            audio_url: url,
            audio_storage_path: path,
            audio_duration_seconds: seconds,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("answers").insert({
          user_id: userId,
          oracle_id: oracleId,
          question_id: questionId,
          variant: 1,
          language,
          body: "",
          audio_url: url,
          audio_storage_path: path,
          audio_duration_seconds: seconds,
        });
      }

      setAudioUrl(url);
      setDuration(seconds);
      setState("ready");

      // Fire transcription in the background. Failure is silent — the
      // audio is preserved either way; transcription is just a nicety.
      kickoffTranscription();
    } catch (err) {
      console.error("voice upload failed:", err);
      setError(err instanceof Error ? err.message : t.error);
      setState(audioUrl ? "ready" : "idle");
    }
  }

  async function kickoffTranscription() {
    setTranscript(null);
    setUsedTranscript(false);
    setTranscribing(true);
    try {
      const res = await fetch("/api/whisper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oracle_id: oracleId,
          question_id: questionId,
        }),
      });
      const data = await res.json();
      if (res.ok && typeof data.text === "string" && data.text.trim()) {
        setTranscript(data.text.trim());
      }
    } catch {
      // silent — audio is fine, transcript is bonus
    } finally {
      setTranscribing(false);
    }
  }

  async function applyTranscript() {
    if (!transcript) return;
    setUsingTranscript(true);
    try {
      const result = await setAnswerBody({
        questionId,
        body: transcript,
      });
      if (result.ok) {
        setUsedTranscript(true);
        // Refresh the server-rendered textarea defaultValue.
        router.refresh();
      } else {
        setError(result.error ?? t.error);
      }
    } finally {
      setUsingTranscript(false);
    }
  }

  async function deleteRecording() {
    if (!confirm(t.confirmDelete)) return;
    setError(null);
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      // Remove from storage. Try both extensions since we don't track
      // which one the user originally recorded.
      for (const ext of ["webm", "m4a"]) {
        await supabase.storage
          .from("archive-audio")
          .remove([`${userId}/${oracleId}/${questionId}.${ext}`])
          .catch(() => undefined);
      }

      // Clear audio columns on the answer row.
      await supabase
        .from("answers")
        .update({
          audio_url: null,
          audio_storage_path: null,
          audio_duration_seconds: null,
        })
        .eq("oracle_id", oracleId)
        .eq("question_id", questionId)
        .eq("variant", 1);

      setAudioUrl(null);
      setDuration(0);
      setState("idle");
    } catch (err) {
      console.error("voice delete failed:", err);
      setError(err instanceof Error ? err.message : t.error);
    }
  }

  function togglePlay() {
    const a = audioElRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setState("playing");
    } else {
      a.pause();
      setState("ready");
    }
  }

  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {state === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex h-9 items-center gap-2 px-4 rounded-full border border-warm-300/40 text-sm text-warm-100 hover:bg-warm-700/40 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-warm-300" />
            {t.record}
          </button>
        )}

        {state === "recording" && (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex h-9 items-center gap-2 px-4 rounded-full bg-red-900/40 border border-red-300/40 text-sm text-red-100 hover:bg-red-900/60 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {t.stop} · {fmt(elapsed)}
            </button>
          </>
        )}

        {state === "uploading" && (
          <span className="text-sm text-warm-300 italic">{t.uploading}</span>
        )}

        {(state === "ready" || state === "playing") && audioUrl && (
          <>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-9 items-center gap-2 px-4 rounded-full bg-warm-50 text-ink text-sm font-medium hover:bg-warm-100 transition-colors"
            >
              {state === "playing" ? "⏸" : "▶"} {t.yourVoice} · {fmt(duration)}
            </button>
            <button
              type="button"
              onClick={startRecording}
              className="text-xs text-warm-300 hover:text-warm-100 transition-colors"
            >
              {t.rerecord}
            </button>
            <button
              type="button"
              onClick={deleteRecording}
              className="text-xs text-warm-400 hover:text-red-300 transition-colors ml-auto"
            >
              {t.delete}
            </button>
            <audio
              ref={audioElRef}
              src={audioUrl}
              preload="none"
              onEnded={() => setState("ready")}
              className="hidden"
            />
          </>
        )}
      </div>

      {/* Transcription block — appears after upload completes. */}
      {(transcribing || transcript) && (
        <div className="mt-3 pt-3 border-t border-warm-700/40">
          {transcribing && !transcript && (
            <p className="text-xs text-warm-300 italic">{t.transcribing}</p>
          )}
          {transcript && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.15em] text-warm-400">
                {t.transcribed}
              </p>
              <p className="text-sm text-warm-100 leading-relaxed font-serif italic">
                “{transcript}”
              </p>
              {!usedTranscript ? (
                <button
                  type="button"
                  onClick={applyTranscript}
                  disabled={usingTranscript}
                  className="inline-flex h-8 items-center px-3 rounded-full bg-warm-50 text-ink text-xs font-medium hover:bg-warm-100 transition-colors disabled:opacity-50"
                >
                  {usingTranscript ? t.using : t.useAsAnswer}
                </button>
              ) : (
                <p className="text-xs text-warm-200 italic">✓ {t.used}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-300/80">{error}</p>}
    </div>
  );
}
