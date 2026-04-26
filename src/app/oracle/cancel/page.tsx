import Link from "next/link";

export const metadata = {
  title: "Payment cancelled — chapter3five",
};

export default function OracleCancelPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>
        <h1 className="font-serif text-3xl text-warm-50 mb-4">
          No charge made.
        </h1>
        <p className="text-warm-200 mb-10 leading-relaxed">
          You backed out before finishing. No problem.
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
