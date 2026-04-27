import Link from "next/link";

/**
 * Shared section/row/link primitives used across the settings hub
 * (/settings, /account, /identities, /sharing). Kept tiny and
 * presentation-only — no data fetching, no client state.
 */

export function Section({
  title,
  children,
  danger,
  id,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mb-10 pb-10 ${
        danger
          ? "border-t border-red-300/20 pt-10"
          : "border-b border-warm-700/40"
      }`}
    >
      <h2 className="font-serif text-2xl text-warm-50 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-warm-700/40 last:border-b-0">
      <span className="text-sm text-warm-300">{label}</span>
      <span
        className={`text-warm-50 ${mono ? "font-mono text-sm" : "font-serif"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function HelpLink({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const className =
    "flex items-center justify-between px-4 py-3 rounded-xl border border-warm-700/60 bg-warm-700/15 text-sm text-warm-100 hover:bg-warm-700/30 hover:border-warm-300/40 transition-colors";
  if (external) {
    return (
      <a href={href} className={className}>
        <span>{label}</span>
        <span className="text-warm-400 text-xs">↗</span>
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <span>{label}</span>
      <span className="text-warm-400 text-xs">→</span>
    </Link>
  );
}
