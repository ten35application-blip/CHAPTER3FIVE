import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-warm-700/50 mt-32">
      <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-serif text-2xl tracking-tight text-warm-100">
            chapter3five
          </span>
          <p className="text-sm text-warm-300 max-w-xs leading-relaxed">
            A new chapter for the people who matter most.
          </p>
        </div>

        <nav className="flex flex-col gap-3 text-sm">
          <Link
            href="/privacy"
            className="text-warm-200 hover:text-warm-50 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-warm-200 hover:text-warm-50 transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/cookies"
            className="text-warm-200 hover:text-warm-50 transition-colors"
          >
            Cookies
          </Link>
          <a
            href="mailto:contact@chapter3five.app"
            className="text-warm-200 hover:text-warm-50 transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
      <div className="max-w-5xl mx-auto px-6 pb-10 text-xs text-warm-400">
        © {new Date().getFullYear()} chapter3five. Coming to App Store and Google Play.
      </div>
    </footer>
  );
}
