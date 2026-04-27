import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "Payment received — chapter3five",
};

export default async function OracleSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl text-warm-50 mb-4">
          <span className="italic font-light">Thank you.</span>
        </h1>
        <p className="text-warm-200 leading-relaxed mb-10 max-w-sm">
          Your credit is on its way. Open the user menu and tap{" "}
          <span className="text-warm-100">+ New identity</span> to begin.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
