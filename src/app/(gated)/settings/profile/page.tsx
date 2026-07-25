import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoWidget } from "./PhotoWidget";

export const metadata = {
  title: "Profile · chapter3five",
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * /settings/profile — the user's own name + photo. Today the photo
 * widget is the only editable field; name lives on profiles.oracle_name
 * but the app addresses users by email everywhere, so name editing can
 * land in a follow-up.
 *
 * The photo is stored in the private `profile-avatars` bucket as
 * `{user_id}/avatar.jpg`. profiles.avatar_url holds the storage path;
 * this server component signs a 1 h URL for the browser to load.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const storagePath = profile?.avatar_url ?? null;
  let signedUrl: string | null = null;
  if (storagePath) {
    const { data: signed } = await supabase.storage
      .from("profile-avatars")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    signedUrl = signed?.signedUrl ?? null;
  }

  const email = user.email ?? "";

  return (
    <main className="min-h-dvh flex-1 pb-16">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-700/70 text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <Image
          src="/logo-transparent.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 drop-shadow-[0_6px_16px_rgba(232,138,118,0.22)]"
        />
        <h1 className="text-xl font-semibold tracking-tight">Profile</h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-8">
        <section>
          <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-warm-300">
            Photo
          </h2>
          <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
            <PhotoWidget email={email} photoUrl={signedUrl} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-warm-300">
            Account
          </h2>
          <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
            <div className="flex items-center px-4 py-3">
              <span className="flex-1 text-base text-warm-50">Email</span>
              <span className="max-w-[55%] truncate text-base text-warm-300">
                {email}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
