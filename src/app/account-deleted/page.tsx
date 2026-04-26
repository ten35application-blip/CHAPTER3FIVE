import Link from "next/link";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "Account deleted — chapter3five",
};

export default function AccountDeletedPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-6 leading-tight">
          <span className="italic font-light">It&rsquo;s done.</span>
        </h1>

        <p className="text-warm-200 text-base leading-relaxed mb-3 max-w-sm">
          Your account, your archive, every answer, every message, every share
          code, every record of payment — all of it has been removed from
          chapter3five.
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-3 max-w-sm">
          The email you used is free. You can sign up again any time.
        </p>
        <p className="text-warm-400 text-xs leading-relaxed mb-12 max-w-sm">
          Refunds for any payment within the last 30 days:{" "}
          <a
            href="mailto:care@chapter3five.app"
            className="text-warm-200 underline underline-offset-2 hover:text-warm-100"
          >
            care@chapter3five.app
          </a>
          .
        </p>

        <p className="font-serif italic text-warm-100 text-base mb-12">
          Thank you for trusting us with this chapter.
        </p>

        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
        >
          Back to the start
        </Link>
      </div>
    </main>
  );
}
