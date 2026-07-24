import Link from "next/link";

type Starred = {
  id: string;
  name: string;
  avatar_url: string | null;
};

const MAX_VISIBLE = 4;

/**
 * The small horizontal strip of starred-identity avatars that sits
 * LEFT of the user avatar in the dashboard's top bar. Tap one to jump
 * straight to that chat.
 *
 * Server component — pure rendering, no state. Data comes from the
 * dashboard page's oracles query (is_starred = true).
 *
 * Hidden entirely when there are no starred identities so the chrome
 * stays quiet for users who haven't pinned anyone.
 */
export function StarredBubbles({ items }: { items: Starred[] }) {
  if (items.length === 0) return null;
  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - visible.length;

  return (
    <div className="flex items-center gap-2" aria-label="Pinned identities">
      {visible.map((p) => (
        <Link
          key={p.id}
          href={`/chat/${p.id}`}
          aria-label={`Chat with ${p.name}`}
          className="group relative"
        >
          <SmallAvatar name={p.name} url={p.avatar_url} />
          <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-warm-50 px-2 py-0.5 text-[10px] font-semibold text-ink opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            {p.name}
          </span>
        </Link>
      ))}
      {overflow > 0 ? (
        <span
          aria-label={`${overflow} more pinned`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-soft text-xs font-semibold text-warm-300 ring-1 ring-warm-700"
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function SmallAvatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-9 rounded-full object-cover shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] ring-2 ring-white/60 transition-transform hover:-translate-y-px"
      />
    );
  }
  return (
    <span className="bg-gradient-cta flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] ring-2 ring-white/60 transition-transform hover:-translate-y-px">
      {initial}
    </span>
  );
}
