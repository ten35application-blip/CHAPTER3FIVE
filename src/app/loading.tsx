/**
 * Root loading state. Suspense boundary for server component fetches
 * so an in-flight page doesn't render as a blank screen while data
 * streams in. Individual routes can override with their own loading.tsx.
 */
export default function GlobalLoading() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="hero-orb flex h-24 w-24 animate-pulse items-center justify-center opacity-70">
          <span aria-hidden className="text-4xl">
            &middot;&middot;
          </span>
        </div>
      </div>
    </main>
  );
}
