"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  oracleId: string;
  questionId: number;
  initialPhotoUrl?: string | null;
  language: "en" | "es";
};

const COPY = {
  en: {
    add: "Add a photo",
    change: "Change photo",
    remove: "Remove photo",
    confirmRemove: "Remove this photo?",
    uploading: "Uploading…",
    error: "Couldn't upload — try a smaller image.",
    tooLarge: "Image too large (max 8MB).",
    notImage: "Only image files.",
  },
  es: {
    add: "Agregar foto",
    change: "Cambiar foto",
    remove: "Quitar foto",
    confirmRemove: "¿Quitar esta foto?",
    uploading: "Subiendo…",
    error: "No se pudo subir — intenta con una imagen más pequeña.",
    tooLarge: "Imagen muy grande (máx 8MB).",
    notImage: "Solo archivos de imagen.",
  },
};

export function PhotoAnswer({
  oracleId,
  questionId,
  initialPhotoUrl = null,
  language,
}: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function pickFile() {
    fileInputRef.current?.click();
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError(t.notImage);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(t.tooLarge);
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${oracleId}/${questionId}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("archive-photos")
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const { data: signed } = await supabase.storage
        .from("archive-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1y
      const url = signed?.signedUrl ?? null;

      // Persist on the answers row. Touch only photo columns — never
      // clobber text or audio. Insert if no row exists yet.
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
            photo_url: url,
            photo_storage_path: path,
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
          photo_url: url,
          photo_storage_path: path,
        });
      }

      setPhotoUrl(url);
      router.refresh();
    } catch (err) {
      console.error("photo upload failed:", err);
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t.confirmRemove)) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      // Best-effort: try common extensions since we don't track which.
      for (const ext of ["jpg", "jpeg", "png", "webp", "heic", "gif"]) {
        await supabase.storage
          .from("archive-photos")
          .remove([`${userId}/${oracleId}/${questionId}.${ext}`])
          .catch(() => undefined);
      }

      await supabase
        .from("answers")
        .update({
          photo_url: null,
          photo_storage_path: null,
        })
        .eq("oracle_id", oracleId)
        .eq("question_id", questionId)
        .eq("variant", 1);

      setPhotoUrl(null);
      router.refresh();
    } catch (err) {
      console.error("photo remove failed:", err);
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 px-4 py-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = "";
        }}
      />

      {photoUrl ? (
        <div className="flex items-start gap-3">
          <img
            src={photoUrl}
            alt=""
            className="w-24 h-24 rounded-xl object-cover border border-warm-300/30 flex-shrink-0"
          />
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={pickFile}
              disabled={busy}
              className="text-xs text-warm-200 hover:text-warm-50 transition-colors text-left disabled:opacity-50"
            >
              {busy ? t.uploading : t.change}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-xs text-warm-400 hover:text-red-300 transition-colors text-left disabled:opacity-50"
            >
              {t.remove}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={busy}
          className="inline-flex h-9 items-center px-4 rounded-full border border-warm-300/40 text-sm text-warm-100 hover:bg-warm-700/40 transition-colors disabled:opacity-50"
        >
          {busy ? t.uploading : t.add}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-300/80">{error}</p>}
    </div>
  );
}
