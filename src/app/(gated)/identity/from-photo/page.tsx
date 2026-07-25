import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createIdentityFromPhoto } from "./actions";

export const metadata = {
  title: "Someone from a photo · chapter3five",
};

/**
 * Photo-to-identity upload form (formula v4). The $5-tier blank slot:
 * upload a photo, Claude Vision reads it, the traits get seeded to match
 * the person, and the uploaded photo becomes the avatar. The reveal
 * reuses /identity/new?id=… — same card, different origin story.
 */
export default async function IdentityFromPhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Image
          src="/logo-transparent.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 drop-shadow-[0_12px_32px_rgba(232,138,118,0.22)]"
        />

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Start from a photo
        </h1>
        <p className="mt-3 text-base text-warm-300">
          Upload a photo of a person and we&apos;ll meet who they could be.
          The photo becomes their face; the rest of them is invented.
        </p>

        {error ? (
          <p className="mt-6 w-full rounded-2xl bg-amber/10 px-4 py-3 text-sm font-medium text-warm-100">
            {error}
          </p>
        ) : null}

        <form action={createIdentityFromPhoto} className="mt-8 w-full">
          <label className="flex w-full cursor-pointer flex-col items-center rounded-2xl border border-dashed border-warm-400/40 px-6 py-8 text-warm-300 transition-colors hover:border-warm-300 hover:text-warm-100">
            <span className="text-sm font-medium">
              Choose a photo (JPEG, PNG, GIF, or WebP — up to 5 MB)
            </span>
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/gif,image/webp"
              required
              className="mt-4 w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-amber file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>

          <button
            type="submit"
            className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-amber text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(107,140,175,0.55),_0_4px_12px_rgba(232,138,118,0.12)] transition-all hover:-translate-y-px hover:shadow-[0_18px_44px_-10px_rgba(107,140,175,0.6),_0_6px_14px_rgba(232,138,118,0.15)] active:translate-y-0 active:opacity-90"
          >
            Meet them
          </button>
        </form>

        <p className="mt-4 text-xs text-warm-400">
          Adults only. Don&apos;t upload photos of real people without their
          OK — and never of anyone under 18.
        </p>

        <Link
          href="/dashboard"
          className="mt-6 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Back to messages
        </Link>
      </div>
    </main>
  );
}
