"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initialUrl: string | null;
  oracleId: string;
  userId: string;
  language: "en" | "es";
};

const COPY = {
  en: {
    upload: "Upload a photo",
    change: "Change photo",
    remove: "Remove",
    uploading: "Uploading…",
    error: "Couldn't upload — try a smaller image.",
  },
  es: {
    upload: "Subir una foto",
    change: "Cambiar foto",
    remove: "Quitar",
    uploading: "Subiendo…",
    error: "No se pudo subir — prueba con una imagen más chica.",
  },
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function AvatarUpload({ initialUrl, oracleId, userId, language }: Props) {
  const t = COPY[language];
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError(t.error);
      return;
    }
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/${oracleId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || `image/${ext}`,
      });

    if (uploadErr) {
      setError(uploadErr.message);
      setBusy(false);
      return;
    }

    const { data: pub } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?t=${Date.now()}`;

    await supabase
      .from("oracles")
      .update({ avatar_url: publicUrl })
      .eq("id", oracleId);
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setUrl(publicUrl);
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Best-effort delete of common extensions; we don't track which they used.
    for (const ext of ["jpg", "jpeg", "png", "webp", "heic"]) {
      await supabase.storage
        .from("avatars")
        .remove([`${userId}/${oracleId}.${ext}`]);
    }
    await supabase
      .from("oracles")
      .update({ avatar_url: null })
      .eq("id", oracleId);
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    setUrl(null);
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-5">
      <div className="w-24 h-24 rounded-full overflow-hidden bg-warm-700/50 border border-warm-400/20 flex items-center justify-center shrink-0">
        {url ? (
          <Image
            src={url}
            alt=""
            width={96}
            height={96}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-warm-400 text-xs font-serif italic">
            no photo
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="h-10 px-4 rounded-full bg-warm-50 text-ink text-sm font-medium hover:bg-warm-100 transition-colors disabled:opacity-60"
        >
          {busy ? t.uploading : url ? t.change : t.upload}
        </button>
        {url && !busy && (
          <button
            type="button"
            onClick={remove}
            className="text-xs text-warm-400 hover:text-warm-200 transition-colors text-left"
          >
            {t.remove}
          </button>
        )}
        {error && <p className="text-xs text-red-300/80">{error}</p>}
      </div>
    </div>
  );
}
