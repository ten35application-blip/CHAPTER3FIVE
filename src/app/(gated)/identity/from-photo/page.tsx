import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoPickerForm } from "./PhotoPickerForm";
import { sanitizeErrorParam } from "@/lib/action-errors";

export const metadata = {
  title: "Someone from a photo · chapter3five",
};

/**
 * Same reason as /identity/new: Server Actions take their timeout from
 * the page. This one is the longer of the two — createIdentityFromPhoto
 * awaits the vision read, then synthesis, then the face.
 */
export const maxDuration = 300;

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
  const { error: rawError } = await searchParams;
  const error = sanitizeErrorParam(rawError);

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

        <PhotoPickerForm />

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
