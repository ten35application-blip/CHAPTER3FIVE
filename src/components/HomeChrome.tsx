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
  trashedCount?: number;
};

const COPY = {
  en: {
    menu: "Menu",
    compose: "New",
    sectionMake: "Make",
    sectionLovedOne: "A loved one",
    newIdentity: "+ New identity",
    newIdentityHint: "Start a fresh archive — yours, your dad's, anyone's.",
    newGroup: "+ New group chat",
    newGroupHint: "Put two or more of your identities in one room.",
    seeRemoved: "See removed identities",
    seeRemovedHint: "Soft-deleted identities still in their 30-day grace.",
    enterCode: "Connect with their code",
    enterCodeHint:
      "An invite code (alive) or claim link (passed). Import codes belong to a fresh account.",
    codePlaceholder: "XXXX-XXXX-XXXX",
    codeCta: "Connect",
    codeError: "That code doesn't look right.",
    modalTitle: "Make a group chat",
    modalIntro:
      "Pick 2–4 of your identities. Name the room. Once you say the first thing, they'll know they're together.",
    needTwo:
      "You need at least 2 identities for a group chat. Make another from + New identity.",
    namePlaceholder: 'Name the room (e.g. "family dinner")',
    pickHint: "Pick 2–4.",
    createCta: "Create",
    creating: "Creating…",
    cancel: "Cancel",
    error: "Couldn't create the group. Try again?",
    drawerPeople: "People",
    drawerAccount: "Account",
    drawerHelp: "Help",
    drawerContacts: "Contacts",
    drawerTrash: "Trash",
    drawerShare: "Share & inherit",
    drawerSettings: "Settings",
    drawerAdmin: "Admin",
    drawerHow: "How chapter3five works",
    drawerSupport: "FAQ & support",
    drawerSignOut: "Sign out",
  },
  es: {
    menu: "Menú",
    compose: "Nuevo",
    sectionMake: "Crear",
    sectionLovedOne: "Un ser querido",
    newIdentity: "+ Nueva identidad",
    newIdentityHint: "Empieza un archivo nuevo — tuyo, de tu papá, de quien sea.",
    newGroup: "+ Nuevo chat grupal",
    newGroupHint: "Pon dos o más de tus identidades en un cuarto.",
    seeRemoved: "Ver identidades eliminadas",
    seeRemovedHint: "Identidades en su periodo de gracia de 30 días.",
    enterCode: "Conectar con su código",
    enterCodeHint:
      "Un código de invitación (vivo) o enlace de herencia (fallecido).",
    codePlaceholder: "XXXX-XXXX-XXXX",
    codeCta: "Conectar",
    codeError: "Ese código no parece correcto.",
    modalTitle: "Crear chat grupal",
    modalIntro:
      "Elige 2–4 de tus identidades. Nombra el cuarto. Cuando digas lo primero, sabrán que están juntas.",
    needTwo:
      "Necesitas al menos 2 identidades. Crea otra desde + Nueva identidad.",
    namePlaceholder: 'Nombre del cuarto (p. ej. "cena familiar")',
    pickHint: "Elige 2–4.",
    createCta: "Crear",
    creating: "Creando…",
    cancel: "Cancelar",
    error: "No se pudo crear el grupo. ¿Intentas de nuevo?",
    drawerPeople: "Personas",
    drawerAccount: "Cuenta",
    drawerHelp: "Ayuda",
    drawerContacts: "Contactos",
    drawerTrash: "Papelera",
    drawerShare: "Compartir y heredar",
    drawerSettings: "Ajustes",
    drawerAdmin: "Admin",
    drawerHow: "Cómo funciona chapter3five",
    drawerSupport: "FAQ y soporte",
    drawerSignOut: "Cerrar sesión",
  },
};

/**
 * Mobile chrome — Google Messages model.
 *
 * Top-left: a small circular avatar button. Tap → a left-side drawer
 * opens with everything that isn't a conversation (Contacts, Trash,
 * Share & inherit, Settings, How it works, Sign out). One door.
 *
 * Top-right: iMessage-style compose pencil. Tap → bottom sheet with
 * all "make a new thing" paths.
 *
 * No bottom-right Settings cog anymore — the drawer covers it. Hidden
 * inside chat threads and on marketing/auth/onboarding. Desktop (md+)
 * uses NavFab instead.
 */
export function HomeChrome({
  language,
  ownedOracles = [],
  userEmail = null,
  isAdmin = false,
  trashedCount = 0,
}: Props) {
  const t = COPY[language];
  const pathname = usePathname();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [codeInputOpen, setCodeInputOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Chrome only shows on the home (conversation list). Subpages all
  // have their own back-arrow headers, so a global avatar/compose
  // would collide with them. Same model iMessage uses: the compose
  // pencil only lives on the Messages list, not inside subpages.
  const onHome = pathname === "/dashboard";
  const hidden = !onHome;

  // Dismiss compose sheet on outside-tap / Escape.
  useEffect(() => {
    if (!composeOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!sheetRef.current) return;
      if (!sheetRef.current.contains(e.target as Node)) setComposeOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setComposeOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [composeOpen]);

  // Dismiss drawer on outside-tap / Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!drawerRef.current) return;
      if (!drawerRef.current.contains(e.target as Node)) setDrawerOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  if (hidden) return null;

  const initial = (userEmail ?? "·").trim().charAt(0).toUpperCase() || "·";

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeShareCode(code);
    if (normalized.length === 12) {
      const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
      router.push(`/invite/${encodeURIComponent(formatted)}`);
      setComposeOpen(false);
      return;
    }
    if (normalized.length === 32) {
      router.push(`/legacy/${encodeURIComponent(normalized.toLowerCase())}`);
      setComposeOpen(false);
      return;
    }
    setCodeErr(t.codeError);
  }

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    if (selected.size < 2 || selected.size > 4 || !groupName.trim()) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          language,
          oracle_ids: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) throw new Error(data?.error ?? t.error);
      router.push(`/groups/${data.id}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t.error);
      setCreating(false);
    }
  }

  return (
    <>
      {/* Top-left avatar button — drawer trigger. */}
      <div
        className="fixed z-30 md:hidden"
        style={{
          left: "max(0.75rem, env(safe-area-inset-left))",
          top: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-haspopup="menu"
          aria-expanded={drawerOpen}
          aria-label={t.menu}
          title={t.menu}
          className="w-12 h-12 rounded-full bg-ink-soft/70 border border-warm-700/50 backdrop-blur-2xl text-warm-100 hover:text-warm-50 hover:bg-ink-soft/85 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] transition-colors font-serif text-base"
        >
          {initial}
        </button>
      </div>

      {/* Top-right compose pill. */}
      <div
        className="fixed z-30 md:hidden"
        style={{
          right: "max(0.75rem, env(safe-area-inset-right))",
          top: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <button
          type="button"
          onClick={() => setComposeOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={composeOpen}
          aria-label={t.compose}
          title={t.compose}
          className="w-12 h-12 rounded-full bg-ink-soft/70 border border-warm-700/50 backdrop-blur-2xl text-warm-100 hover:text-warm-50 hover:bg-ink-soft/85 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] transition-colors"
        >
          <ComposeIcon />
        </button>
      </div>

      {/* Left drawer — Google Messages style. Slides in from the left
          edge; backdrop blurs the rest of the app. */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-ink/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
        >
          <div
            ref={drawerRef}
            className="absolute inset-y-0 left-0 w-[82vw] max-w-[340px] bg-ink-soft border-r border-warm-700/40 shadow-2xl overflow-y-auto animate-drawer-in"
            style={{
              paddingTop: "max(1.25rem, env(safe-area-inset-top))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
            }}
          >
            {/* Identity card */}
            <div className="px-5 pb-5 border-b border-warm-700/40">
              <div className="w-14 h-14 rounded-full bg-warm-700/40 border border-warm-700/60 flex items-center justify-center font-serif text-2xl text-warm-100 mb-3">
                {initial}
              </div>
              {userEmail && (
                <p className="text-sm text-warm-200 truncate">{userEmail}</p>
              )}
            </div>

            <SectionLabel>{t.drawerPeople}</SectionLabel>
            <DrawerRow
              href="/contacts"
              icon={<PeopleIcon />}
              label={t.drawerContacts}
              onSelect={() => setDrawerOpen(false)}
            />
            <DrawerRow
              href="/trash"
              icon={<TrashIcon />}
              label={t.drawerTrash}
              badge={trashedCount > 0 ? String(trashedCount) : undefined}
              onSelect={() => setDrawerOpen(false)}
            />

            <SectionLabel>{t.drawerAccount}</SectionLabel>
            <DrawerRow
              href="/sharing"
              icon={<ShareIcon />}
              label={t.drawerShare}
              onSelect={() => setDrawerOpen(false)}
            />
            <DrawerRow
              href="/account"
              icon={<SettingsIcon />}
              label={t.drawerSettings}
              onSelect={() => setDrawerOpen(false)}
            />
            {isAdmin && (
              <DrawerRow
                href="/admin"
                icon={<AdminIcon />}
                label={t.drawerAdmin}
                onSelect={() => setDrawerOpen(false)}
              />
            )}

            <SectionLabel>{t.drawerHelp}</SectionLabel>
            <DrawerRow
              href="/how"
              icon={<HowIcon />}
              label={t.drawerHow}
              onSelect={() => setDrawerOpen(false)}
            />
            <DrawerRow
              href="/support"
              icon={<HelpIcon />}
              label={t.drawerSupport}
              onSelect={() => setDrawerOpen(false)}
            />

            <div className="mt-6 border-t border-warm-700/40 pt-3">
              <form action={signOut}>
                <button
                  type="submit"
                  className="block w-full text-left px-5 py-3 text-sm text-warm-200 hover:bg-warm-700/30 transition-colors"
                >
                  {t.drawerSignOut}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Compose sheet — unchanged from before. */}
      {composeOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden flex items-end justify-center bg-ink/60 backdrop-blur-sm"
          aria-modal="true"
          role="dialog"
        >
          <div
            ref={sheetRef}
            className="w-full max-w-md bg-ink-soft border-t border-warm-300/30 rounded-t-3xl shadow-2xl overflow-hidden animate-sheet-up"
            style={{
              paddingBottom:
                "max(0.5rem, env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-warm-700/60" />
            </div>

            <p className="text-[10px] uppercase tracking-[0.25em] text-warm-400 px-5 pt-2 pb-1">
              {t.sectionMake}
            </p>

            <form action={newOracle}>
              <button
                type="submit"
                className="block w-full text-left px-5 py-3 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40 active:bg-warm-700/60"
              >
                <p className="text-sm font-medium text-warm-50">
                  {t.newIdentity}
                </p>
                <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                  {t.newIdentityHint}
                </p>
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setComposeOpen(false);
                setGroupModalOpen(true);
              }}
              className="block w-full text-left px-5 py-3 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40 active:bg-warm-700/60"
            >
              <p className="text-sm font-medium text-warm-50">{t.newGroup}</p>
              <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                {t.newGroupHint}
              </p>
            </button>

            <Link
              href="/trash"
              onClick={() => setComposeOpen(false)}
              className="block px-5 py-3 hover:bg-warm-700/40 transition-colors active:bg-warm-700/60"
            >
              <p className="text-sm font-medium text-warm-50">{t.seeRemoved}</p>
              <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                {t.seeRemovedHint}
              </p>
            </Link>

            <div className="border-t-2 border-warm-700/60">
              <p className="text-[10px] uppercase tracking-[0.25em] text-warm-400 px-5 pt-3 pb-1">
                {t.sectionLovedOne}
              </p>

              {!codeInputOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setCodeInputOpen(true);
                    setCodeErr(null);
                  }}
                  className="block w-full text-left px-5 py-3 hover:bg-warm-700/40 transition-colors active:bg-warm-700/60"
                >
                  <p className="text-sm font-medium text-warm-50">
                    {t.enterCode}
                  </p>
                  <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                    {t.enterCodeHint}
                  </p>
                </button>
              ) : (
                <form onSubmit={submitCode} className="px-5 py-3 space-y-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeErr(null);
                    }}
                    placeholder={t.codePlaceholder}
                    autoFocus
                    spellCheck={false}
                    autoCapitalize="characters"
                    className="w-full h-11 rounded-full bg-warm-700/40 border border-warm-400/40 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm font-mono tracking-wider uppercase"
                  />
                  {codeErr && (
                    <p className="text-xs text-red-300/80 px-1">{codeErr}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCodeInputOpen(false);
                        setCode("");
                        setCodeErr(null);
                      }}
                      className="h-11 px-4 rounded-full border border-warm-400/30 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={!code.trim()}
                      className="flex-1 h-11 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {t.codeCta}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group-create modal — unchanged. */}
      {groupModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGroupModalOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-ink-soft border border-warm-300/40 rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-serif text-xl text-warm-50">
                {t.modalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="w-11 h-11 -m-2 flex items-center justify-center text-warm-400 hover:text-warm-100 transition-colors text-xl leading-none"
                aria-label={t.cancel}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-warm-300 mb-5 leading-relaxed">
              {t.modalIntro}
            </p>

            {ownedOracles.length < 2 ? (
              <p className="text-sm text-warm-200 italic">{t.needTwo}</p>
            ) : (
              <form onSubmit={createGroup} className="space-y-4">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  maxLength={80}
                  className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                />

                <div>
                  <p className="text-xs text-warm-300 mb-2">{t.pickHint}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ownedOracles.map((o) => {
                      const isSel = selected.has(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleSel(o.id)}
                          className={
                            isSel
                              ? "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-50 bg-warm-50 text-ink transition-colors"
                              : "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-400/30 bg-warm-700/20 text-warm-100 hover:bg-warm-700/40 transition-colors"
                          }
                        >
                          {o.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.avatarUrl}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span
                              className={
                                isSel
                                  ? "w-7 h-7 rounded-full bg-warm-300/50 flex-shrink-0"
                                  : "w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0"
                              }
                            />
                          )}
                          <span className="text-sm truncate">{o.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {err && <p className="text-sm text-red-300/80">{err}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModalOpen(false)}
                    className="h-11 px-4 rounded-full border border-warm-400/30 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      creating ||
                      selected.size < 2 ||
                      selected.size > 4 ||
                      !groupName.trim()
                    }
                    className="flex-1 h-11 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {creating ? t.creating : t.createCta}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.22em] text-warm-400 px-5 pt-5 pb-2">
      {children}
    </p>
  );
}

function DrawerRow({
  href,
  icon,
  label,
  badge,
  onSelect,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex items-center gap-3 px-5 py-3 text-warm-50 hover:bg-warm-700/30 active:bg-warm-700/50 transition-colors"
    >
      <span className="w-9 h-9 rounded-xl bg-warm-700/40 text-warm-100 flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="flex-1 text-base">{label}</span>
      {badge && (
        <span className="text-xs text-warm-300 bg-warm-700/40 rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
    </Link>
  );
}

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21v-3.5L15 6.5l3.5 3.5L7.5 21z" />
      <path d="M14 7.5L17 4.5l3.5 3.5-3 3" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3.2" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" />
      <path d="M14 17c.5-1.8 2.3-3 4.5-3s3.5 1 3.5 3" />
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

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function HowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-1 .4-1 1.2-1 2.2" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.4 8.4 0 0 1-3.9-.7L3 21l1.6-4.4A8.4 8.4 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </svg>
  );
}
