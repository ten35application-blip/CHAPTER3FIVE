"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { newOracle } from "@/app/oracles/actions";
import { signOut } from "@/app/auth/actions";
import { normalizeShareCode } from "@/lib/share";

type Oracle = { id: string; name: string; avatarUrl: string | null };

type Props = {
  language: "en" | "es";
  ownedOracles?: Oracle[];
  userEmail?: string | null;
  isAdmin?: boolean;
};

const COPY = {
  en: {
    edit: "Edit",
    new: "New",
    trash: "Recently deleted",
    nameAndPhoto: "Name & Photo",
    create: "Create an identity",
    inherit: "Inherit an identity",
    settings: "Settings",
    admin: "Admin",
    signOut: "Sign out",
    inheritPrompt: "Paste the code or claim link.",
    inheritPlaceholder: "XXXX-XXXX-XXXX",
    inheritCta: "Connect",
    inheritCancel: "Cancel",
    inheritError: "That code doesn't look right.",
    pickerTitle: "Who do you want to message?",
    pickerEmpty:
      "No one yet. Tap Edit at the top to create someone.",
    unnamed: "(unnamed)",
  },
  es: {
    edit: "Editar",
    new: "Nuevo",
    trash: "Eliminados recientemente",
    nameAndPhoto: "Nombre y foto",
    create: "Crear una identidad",
    inherit: "Heredar una identidad",
    settings: "Ajustes",
    admin: "Admin",
    signOut: "Cerrar sesión",
    inheritPrompt: "Pega el código o enlace.",
    inheritPlaceholder: "XXXX-XXXX-XXXX",
    inheritCta: "Conectar",
    inheritCancel: "Cancelar",
    inheritError: "Ese código no parece correcto.",
    pickerTitle: "¿A quién quieres escribir?",
    pickerEmpty:
      "Aún no hay nadie. Toca Editar arriba para crear alguien.",
    unnamed: "(sin nombre)",
  },
};

/**
 * Mobile chrome on /dashboard, modeled on the iMessage screenshot
 * reference. Three persistent buttons:
 *
 *   Top-left:    "Edit" pill → dropdown menu (profile + actions)
 *   Top-right:   trash icon  → /trash directly (no menu)
 *   Bottom-right: + FAB      → bottom sheet picker → /chat/[id]
 *
 * Edit menu contents (per design Q): profile card on top, then
 * Create identity, Inherit identity, Settings, Admin (if), Sign out.
 *
 * Only shown on /dashboard. Subpages have their own back-arrow headers
 * so a global floating chrome would collide. Desktop uses NavFab.
 */
export function HomeChrome({
  language,
  ownedOracles = [],
  userEmail = null,
  isAdmin = false,
}: Props) {
  const t = COPY[language];
  const pathname = usePathname();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inheritOpen, setInheritOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);

  const editRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const onHome = pathname === "/dashboard";

  useEffect(() => {
    if (!editOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!editRef.current) return;
      if (!editRef.current.contains(e.target as Node)) {
        setEditOpen(false);
        setInheritOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditOpen(false);
        setInheritOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [editOpen]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  if (!onHome) return null;

  const initial = (userEmail ?? "·").trim().charAt(0).toUpperCase() || "·";

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeShareCode(code);
    if (normalized.length === 12) {
      const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
      router.push(`/invite/${encodeURIComponent(formatted)}`);
      setEditOpen(false);
      setInheritOpen(false);
      return;
    }
    if (normalized.length === 32) {
      router.push(`/legacy/${encodeURIComponent(normalized.toLowerCase())}`);
      setEditOpen(false);
      setInheritOpen(false);
      return;
    }
    setCodeErr(t.inheritError);
  }

  return (
    <>
      {/* Top-left Edit pill — rounded gray, like Apple's. */}
      <div
        ref={editRef}
        className="fixed z-30 md:hidden"
        style={{
          left: "max(0.75rem, env(safe-area-inset-left))",
          top: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setEditOpen((v) => !v);
            setInheritOpen(false);
          }}
          aria-haspopup="menu"
          aria-expanded={editOpen}
          className="h-9 px-4 rounded-full bg-warm-700/60 text-warm-100 hover:bg-warm-700 active:bg-warm-600 text-sm font-medium transition-colors backdrop-blur-md"
        >
          {t.edit}
        </button>

        {/* Edit dropdown menu — appears below the pill. */}
        {editOpen && (
          <div className="absolute left-0 top-12 w-[280px] rounded-2xl bg-ink-soft border border-warm-700/60 shadow-2xl overflow-hidden animate-menu-in">
            {/* Profile card */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-700/40">
              <div className="w-10 h-10 rounded-full bg-warm-700/60 flex items-center justify-center text-base font-medium text-warm-100">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-50 truncate">
                  {userEmail ?? "—"}
                </p>
                <p className="text-xs text-warm-400">{t.nameAndPhoto}</p>
              </div>
            </div>

            {/* Identity actions */}
            <form action={newOracle}>
              <button
                type="submit"
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-warm-50 hover:bg-warm-700/40 active:bg-warm-700/60 transition-colors"
              >
                <PlusIcon /> <span>{t.create}</span>
              </button>
            </form>

            {!inheritOpen ? (
              <button
                type="button"
                onClick={() => {
                  setInheritOpen(true);
                  setCodeErr(null);
                }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-sm text-warm-50 hover:bg-warm-700/40 active:bg-warm-700/60 transition-colors border-b border-warm-700/40"
              >
                <InheritIcon /> <span>{t.inherit}</span>
              </button>
            ) : (
              <form
                onSubmit={submitCode}
                className="px-4 py-3 space-y-2 border-b border-warm-700/40"
              >
                <p className="text-xs text-warm-400">{t.inheritPrompt}</p>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeErr(null);
                  }}
                  placeholder={t.inheritPlaceholder}
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="w-full h-10 rounded-full bg-warm-700/40 border border-warm-600 px-4 text-sm text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-amber font-mono tracking-wider uppercase"
                />
                {codeErr && (
                  <p className="text-xs text-red-400 px-1">{codeErr}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInheritOpen(false);
                      setCode("");
                      setCodeErr(null);
                    }}
                    className="h-9 px-3 rounded-full text-warm-300 hover:bg-warm-700/40 transition-colors text-sm"
                  >
                    {t.inheritCancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!code.trim()}
                    className="flex-1 h-9 rounded-full bg-amber text-ink-soft font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-opacity"
                  >
                    {t.inheritCta}
                  </button>
                </div>
              </form>
            )}

            {/* Settings / admin */}
            <Link
              href="/account"
              onClick={() => setEditOpen(false)}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-warm-50 hover:bg-warm-700/40 active:bg-warm-700/60 transition-colors"
            >
              <SettingsIcon /> <span>{t.settings}</span>
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setEditOpen(false)}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-warm-50 hover:bg-warm-700/40 active:bg-warm-700/60 transition-colors"
              >
                <AdminIcon /> <span>{t.admin}</span>
              </Link>
            )}

            {/* Sign out — separated */}
            <form action={signOut} className="border-t border-warm-700/40">
              <button
                type="submit"
                className="w-full px-4 py-3 text-left text-sm text-warm-300 hover:bg-warm-700/40 active:bg-warm-700/60 transition-colors"
              >
                {t.signOut}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Top-right trash icon — direct to /trash, no menu. */}
      <Link
        href="/trash"
        aria-label={t.trash}
        title={t.trash}
        className="fixed z-30 md:hidden w-10 h-10 rounded-full bg-warm-700/60 backdrop-blur-md text-warm-100 hover:bg-warm-700 active:bg-warm-600 flex items-center justify-center transition-colors"
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          top: "max(0.875rem, env(safe-area-inset-top))",
        }}
      >
        <TrashIcon />
      </Link>

      {/* Bottom-right + FAB — opens contacts picker. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-label={t.new}
        title={t.new}
        className="fixed z-30 md:hidden w-14 h-14 rounded-full bg-amber text-ink-soft flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35)] hover:opacity-95 active:opacity-90 transition-opacity"
        style={{
          right: "max(1rem, env(safe-area-inset-right))",
          bottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <BigPlusIcon />
      </button>

      {/* Contacts picker — bottom sheet, lists every live identity. */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden flex items-end justify-center bg-ink/40 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
        >
          <div
            ref={pickerRef}
            className="w-full max-w-md bg-ink-soft border-t border-warm-700/40 rounded-t-3xl shadow-2xl overflow-hidden animate-sheet-up max-h-[80vh] flex flex-col"
            style={{
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-warm-600" />
            </div>
            <p className="text-center text-sm font-medium text-warm-100 px-5 py-2 border-b border-warm-700/40 flex-shrink-0">
              {t.pickerTitle}
            </p>

            <div className="overflow-y-auto flex-1">
              {ownedOracles.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-warm-400">
                  {t.pickerEmpty}
                </p>
              ) : (
                <ul>
                  {ownedOracles.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/chat/${o.id}`}
                        onClick={() => setPickerOpen(false)}
                        className="flex items-center gap-3 px-5 py-3 text-warm-50 hover:bg-warm-700/40 active:bg-warm-700/60 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-warm-700/50 flex-shrink-0">
                          {o.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-sm text-warm-200">
                              {(o.name?.trim().charAt(0) || "·").toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-base truncate">
                          {o.name?.trim() || t.unnamed}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BigPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function InheritIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 5 5v6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
