"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Email-substring search for the users table. Debounced 300ms into the
 * `q` query param (resets to page 1) so the server component re-filters.
 */
export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  function onChange(next: string) {
    setValue(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (next.trim()) params.set("q", next.trim());
      router.replace(`/admin/users${params.size ? `?${params}` : ""}`);
    }, 300);
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by email…"
      aria-label="Search users by email"
      className="h-11 w-full max-w-sm rounded-full bg-ink-soft px-5 text-sm text-warm-50 ring-1 ring-warm-700 outline-none transition-shadow placeholder:text-warm-400 focus:ring-2 focus:ring-coral/50"
    />
  );
}
