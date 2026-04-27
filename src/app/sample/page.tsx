import Link from "next/link";
import { SampleChat } from "./SampleChat";

export const metadata = {
  title: "Try chapter3five — meet a sample identity",
  description:
    "Talk to a sample person archived on chapter3five. No sign-up needed. See what an archive feels like before you make your own.",
};

export default function SamplePage() {
  return (
    <main className="flex-1 flex flex-col px-6 py-6 relative overflow-hidden">
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between mb-8">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          chapter3five
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
            sample
          </span>
          <Link
            href="/auth/signup"
            className="inline-flex h-9 items-center justify-center rounded-full bg-warm-50 px-4 text-xs font-medium text-ink hover:bg-warm-100 transition-colors"
          >
            Make your own
          </Link>
        </div>
      </header>

      <div className="max-w-2xl w-full mx-auto text-center mb-6">
        <p className="text-warm-300 text-sm leading-relaxed">
          This is a sample identity — a real-feeling person built from the
          kind of answers you&rsquo;d give yourself. Try a conversation. No
          sign-up needed.
        </p>
      </div>

      <div className="flex-1 flex justify-center">
        <SampleChat />
      </div>
    </main>
  );
}
