import Link from "next/link";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "chapter3five",
};

const COPY = {
  ok: {
    title: "Cancelled.",
    body: "Thanks for confirming. Your archive stays private. We let the person who reported know we couldn't verify it.",
  },
  already: {
    title: "Already cancelled.",
    body: "This report was already dismissed. You're set — nothing more to do.",
  },
  expired: {
    title: "Window closed.",
    body: "The 72-hour cancel window has already passed. If something is wrong, please reach out at care@chapter3five.app.",
  },
  notfound: {
    title: "Not found.",
    body: "This link doesn't match anything we have. Double-check it, or reach out at care@chapter3five.app.",
  },
};

export default async function PassingCancelResultPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state = "ok" } = await searchParams;
  const t = (COPY as Record<string, { title: string; body: string }>)[state] ?? COPY.ok;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
        <Orb size={460} />
      </div>
      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>
        <h1 className="font-serif text-3xl text-warm-50 mb-4">{t.title}</h1>
        <p className="text-warm-200 leading-relaxed mb-10 max-w-sm">
          {t.body}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
