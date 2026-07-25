"use client";

import type { ReactNode } from "react";
import { useState } from "react";

/**
 * User profile photo with a graceful onError fallback. Wilson's private
 * `profile-avatars` bucket is signed server-side (1 h TTL) and the URL
 * is passed in via `signedUrl`, but the browser can still fail to load
 * it — expired token on a stale tab, a network blip, a transient 4xx
 * from storage. When that happens, older iOS Safari renders its
 * broken-image "?" glyph, which reads as a bug. This component swaps in
 * the caller-supplied fallback (usually the initial letter) instead so
 * the chrome stays clean under any load failure.
 *
 * `signedUrl` null → the fallback renders directly; no img element
 * mounts. Same behavior when a mounted img fires onError.
 */
export function ProfileAvatarImage({
  signedUrl,
  fallback,
  alt = "",
  className,
}: {
  signedUrl: string | null;
  /** Rendered when signedUrl is null or the img errors. */
  fallback: ReactNode;
  alt?: string;
  /** Applied to the <img> in the success branch. */
  className: string;
}) {
  // Reset the failed flag whenever the URL changes: after a fresh
  // upload the parent hands us a brand-new signed URL, and any prior
  // failure (expired token, transient 4xx) shouldn't stick and keep
  // us in the fallback branch forever. The "reset state on prop
  // change during render" pattern (see react.dev/reference/react/useState)
  // avoids the cascading-render cost of doing this in useEffect.
  const [prevUrl, setPrevUrl] = useState(signedUrl);
  const [failed, setFailed] = useState(false);
  if (prevUrl !== signedUrl) {
    setPrevUrl(signedUrl);
    setFailed(false);
  }

  if (!signedUrl || failed) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={signedUrl}
      src={signedUrl}
      alt={alt}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
