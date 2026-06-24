/**
 * Skeleton primitives used by route-level loading.tsx files.
 *
 * Server-component-safe (no client hooks). The shimmer is pure
 * CSS animation so there's no JS to ship. Each skeleton mirrors
 * the shape of the content it replaces so the perceived loading
 * time drops dramatically — skeletons feel like data arriving;
 * spinners feel like waiting.
 */

function Pulse({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-warm-700/40 animate-pulse rounded ${className}`}
      aria-hidden
    />
  );
}

/**
 * Conversation list row — avatar + two lines + chevron.
 * Matches the dashboard ConversationRow visual rhythm.
 */
export function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="w-2.5 h-2.5" aria-hidden />
      <Pulse className="w-12 h-12 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Pulse className="h-3.5 w-32" />
          <Pulse className="h-3 w-10" />
        </div>
        <Pulse className="h-3 w-3/4" />
      </div>
      <span className="text-warm-500 text-lg" aria-hidden>
        ›
      </span>
    </div>
  );
}

/**
 * Full dashboard skeleton — title, search hint, favorites strip,
 * 4 conversation rows. Hit by the route transition from any
 * signed-in page back to /dashboard.
 */
export function DashboardSkeleton() {
  return (
    <main className="flex-1">
      <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 pt-6 pb-32">
        <div className="flex items-end justify-between mb-5 px-2 gap-3">
          <Pulse className="h-9 w-56" />
          <Pulse className="w-10 h-10 rounded-full" />
        </div>
        <Pulse className="h-10 w-full rounded-full mb-6" />
        <div className="rounded-2xl overflow-hidden bg-ink-soft">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={i === 3 ? "" : "border-b border-warm-700/30"}
            >
              <ConversationRowSkeleton />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

/**
 * Chat-page skeleton — wordmark + identity name header, a few
 * message bubbles in alternating alignment, send box at the
 * bottom. Mirrors Chat.tsx's structure.
 */
export function ChatSkeleton() {
  return (
    <main className="flex-1 flex flex-col px-6 py-4 h-[100dvh]">
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between mb-2 flex-shrink-0">
        <Pulse className="h-6 w-32" />
        <Pulse className="h-3 w-24" />
      </header>
      <div className="flex-1 flex justify-center min-h-0">
        <div className="w-full max-w-2xl flex flex-col gap-4 px-1 py-6">
          <div className="flex justify-end">
            <Pulse className="h-12 w-56 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Pulse className="h-16 w-2/3 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Pulse className="h-10 w-40 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Pulse className="h-12 w-3/4 rounded-2xl" />
          </div>
        </div>
      </div>
      <div className="max-w-2xl w-full mx-auto flex-shrink-0">
        <Pulse className="h-14 rounded-full" />
      </div>
    </main>
  );
}

/**
 * Settings-style page skeleton — header + a few section blocks.
 * Reused by /account, /sharing, /identities.
 */
export function SettingsSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <main className="flex-1">
      <div className="max-w-2xl mx-auto px-6 py-12 pb-32 space-y-10">
        <div className="space-y-3">
          <Pulse className="h-10 w-64" />
          <Pulse className="h-4 w-3/4" />
        </div>
        {Array.from({ length: sections }).map((_, i) => (
          <div key={i} className="space-y-3 pb-6 border-b border-warm-700/30">
            <Pulse className="h-3 w-32 mb-3" />
            <Pulse className="h-11 w-full rounded-full" />
            <Pulse className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </main>
  );
}
