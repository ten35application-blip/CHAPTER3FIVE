import Link from "next/link";
import { redirect } from "next/navigation";
import { Orb } from "@/components/Orb";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Email confirmed — chapter3five",
};

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-2xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
          <span className="italic font-light">You&rsquo;re in.</span>
        </h1>
        <p className="text-warm-200 text-lg leading-relaxed mb-2">
          Email confirmed. The chapter is ready when you are.
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-12 max-w-sm">
          A reminder: chapter3five is a quiet place. Talk to someone the way
          you&rsquo;d talk to anyone you care about. They&rsquo;ll talk back.
        </p>

        <Link
          href={target}
          className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
        >
          Continue
        </Link>
      </div>
    </main>
  );
}
