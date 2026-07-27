import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";

/**
 * Dashboard metric card — big number, small label, optional delta chip
 * comparing against the previous period. Server component.
 *
 * When `href` is passed the whole card becomes a Link so a cohort
 * count (e.g. "Paid Pro: 12") is one tap from the filtered user
 * list.
 */
export function MetricCard({
  label,
  value,
  delta,
  deltaLabel = "vs last week",
  hint,
  href,
}: {
  label: string;
  value: string | number;
  /** Absolute change vs the previous period. Omit to hide the chip. */
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  /** Optional drill-down. Renders the card as a Link with a subtle
   *  hover ring so the user knows it's tappable. */
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-warm-400">
        {label}
      </p>
      <p className="text-3xl font-semibold tracking-tight text-warm-50">
        {value}
      </p>
      {delta !== undefined ? (
        <p className="text-xs font-medium">
          {delta > 0 ? (
            <span className="text-gradient-cta font-semibold">
              ↑ +{delta.toLocaleString()}
            </span>
          ) : (
            <span className="text-warm-400">
              {delta < 0 ? `↓ ${delta.toLocaleString()}` : "— 0"}
            </span>
          )}{" "}
          <span className="text-warm-400">{deltaLabel}</span>
        </p>
      ) : null}
      {hint ? <p className="text-xs text-warm-400">{hint}</p> : null}
    </>
  );

  const baseClass =
    "flex flex-col gap-1 rounded-2xl bg-ink-soft px-5 py-4 shadow-[0_10px_28px_-14px_rgba(28,28,26,0.14)] ring-1 ring-warm-700";

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} transition-all hover:-translate-y-px hover:ring-coral/40`}
      >
        {body}
      </Link>
    );
  }
  return <div className={baseClass}>{body}</div>;
}

/**
 * Section wrapper for a titled grid of metric cards.
 *
 * When `collapsibleKey` is passed, the whole section becomes a
 * chevron-toggle whose open/closed state persists across the
 * session under that key. Server component either way — the
 * collapsibility comes from the shared CollapsibleSection client
 * component. Wilson's ask: hide/show each admin section on
 * demand.
 */
export function MetricSection({
  title,
  children,
  collapsibleKey,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  /** Enables the chevron toggle. Unique per section on a page. */
  collapsibleKey?: string;
  /** Default state before sessionStorage restores. */
  defaultOpen?: boolean;
}) {
  const grid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );

  if (collapsibleKey) {
    return (
      <CollapsibleSection
        storageKey={collapsibleKey}
        label={title}
        defaultOpen={defaultOpen}
      >
        <div className="mt-3">{grid}</div>
      </CollapsibleSection>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
        {title}
      </h2>
      {grid}
    </section>
  );
}

/** Warm empty-state card — used when a data source isn't wired yet. */
export function EmptyStateCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="col-span-full flex flex-col items-start gap-1.5 rounded-2xl bg-ink-soft px-6 py-6 ring-1 ring-warm-700">
      <p className="text-base font-semibold text-warm-50">{title}</p>
      <p className="max-w-prose text-sm leading-relaxed text-warm-300">{body}</p>
    </div>
  );
}
