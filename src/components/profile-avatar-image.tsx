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
 *
 * URL-scoped failure state (fabd853 → this commit): we track WHICH url
 * failed, not just "something failed". The old boolean flag caused
 * Wilson's "goes to a place, boom back to the original photo" bug on
 * iOS Safari 27: on every fresh upload the `key={signedUrl}` swap
 * unmounted the old <img> whose in-flight request was aborted, and
 * Safari fires onError on that aborted request. The handler ran with
 * the OLD closure and called setFailed(true) on the parent — which was
 * already displaying the NEW signed URL. Result: fallback stuck on
 * even though the fresh photo had literally started rendering a
 * millisecond earlier. Scoping failure to a specific URL makes the
 * stale abort a no-op: the outgoing failure doesn't apply to the
 * incoming URL.
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!signedUrl || failedUrl === signedUrl) {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={signedUrl}
      src={signedUrl}
      alt={alt}
      onError={() => setFailedUrl(signedUrl)}
      className={className}
    />
  );
}
